import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { descriptorPattern, expansionPattern, leadingTabsPattern, parameterPattern, parseScript, redirectPattern, type Word } from './shell.ts'

const texts = (script: string): string[][] => parseScript(script).map((command) => command.words.map((word) => word.text))

const wordsOf = (script: string): Word[][] => parseScript(script).map((command) => command.words)

const literal = (text: string): Word => ({ text, dynamic: false })

const captures = (text: string, pattern: RegExp): string[] => [...(text.match(pattern) ?? [])]

describe('All Tagline Shell Tests', () => {
  describe('parseScript', () => {
    it('splits a script into commands on its operators', () => {
      // Act & Assert
      assertEquals(texts('git add -A && gh issue list ; echo done | cat || true & wait\nls'), [
        ['git', 'add', '-A'],
        ['gh', 'issue', 'list'],
        ['echo', 'done'],
        ['cat'],
        ['true'],
        ['wait'],
        ['ls'],
      ])
    })

    it('joins a line continued with a backslash into one command', () => {
      // Act & Assert
      assertEquals(texts('echo a \\\n  b'), [['echo', 'a', 'b']])
    })

    it('keeps operators inside quotes as text', () => {
      // Act & Assert
      assertEquals(texts(`gh issue comment 1 --body "a && b; c" 'd | e'`), [['gh', 'issue', 'comment', '1', '--body', 'a && b; c', 'd | e']])
    })

    it('keeps the source of each command', () => {
      // Act
      const commands = parseScript('echo a && gh pr list')

      // Assert
      assertEquals(commands.map((command) => command.source), ['echo a', 'gh pr list'])
    })

    it('reads a heredoc body as input rather than as commands', () => {
      // Act & Assert
      assertEquals(texts('cat <<EOF\ngh issue create --body x && y\nEOF\necho done'), [['cat'], ['echo', 'done']])
    })

    it('lists the commands inside a substitution before the command holding it, which sees the substitution as dynamic', () => {
      // Act
      const commands = parseScript('x=$(gh issue list)')

      // Assert
      assertEquals(commands.map(({ words, source }) => ({ words, source })), [
        { words: [literal('gh'), literal('issue'), literal('list')], source: 'gh issue list' },
        { words: [{ text: 'x=$(gh issue list)', dynamic: true }], source: 'x=$(gh issue list)' },
      ])
    })

    it('lists the commands inside a subshell and a process substitution', () => {
      // Act & Assert
      assertEquals(texts('(a b) && diff <(gh pr diff 1) c'), [['a', 'b'], ['gh', 'pr', 'diff', '1'], ['diff', 'c']])
    })

    it('drops redirections and their targets, including a file descriptor before one', () => {
      // Act & Assert
      assertEquals(texts('gh pr list > out.txt 2>&1 &>> all.log < in.txt'), [['gh', 'pr', 'list']])
    })

    it('records each redirection with its target, leaving a file descriptor before one out', () => {
      // Act
      const commands = parseScript('gh pr list > out.txt 2>&1 &>> all.log < in.txt <<< "$X"')

      // Assert
      assertEquals(commands.map((command) => command.redirects), [[
        { operator: '>', target: literal('out.txt') },
        { operator: '>&', target: literal('1') },
        { operator: '&>>', target: literal('all.log') },
        { operator: '<', target: literal('in.txt') },
        { operator: '<<<', target: { text: '$X', dynamic: true } },
      ]])
    })

    it('records a heredoc on the command that reads it, quoted or not', () => {
      // Act
      const commands = parseScript("cat <<'A' > a.md\none\nA\ncat <<B\ntwo\nB")

      // Assert
      assertEquals(commands.map((command) => command.heredocs), [[{ body: 'one', quoted: true }], [{ body: 'two', quoted: false }]])
    })

    it('links a command to the one piped into it, and not across ||', () => {
      // Act
      const commands = parseScript('printf x | tee a.md || echo y')

      // Assert
      assertEquals(commands.map((command) => command.upstream.map((upstream) => upstream.source)), [[], ['printf x'], []])
    })

    it('joins a line continued with a backslash inside double quotes', () => {
      // Act & Assert
      assertEquals(texts('echo "a\\\nb"'), [['echo', 'ab']])
    })

    it('drops a comment but keeps a hash inside a word', () => {
      // Act & Assert
      assertEquals(texts('gh pr view 4#x # a note'), [['gh', 'pr', 'view', '4#x']])
    })

    it('reads single-quoted text literally, never as an expansion', () => {
      // Act & Assert
      assertEquals(wordsOf("echo '$(x) $y'"), [[literal('echo'), literal('$(x) $y')]])
    })

    it('marks a variable, a braced parameter, and a backtick substitution as dynamic', () => {
      // Act & Assert
      assertEquals(wordsOf('echo $HOME ${X:-y} `date`'), [
        [literal('date')],
        [literal('echo'), { text: '$HOME', dynamic: true }, { text: '${X:-y}', dynamic: true }, { text: '`date`', dynamic: true }],
      ])
    })

    it('reads an escaped dollar sign as text', () => {
      // Act & Assert
      assertEquals(wordsOf('echo \\$5 "\\$6"'), [[literal('echo'), literal('$5'), literal('$6')]])
    })

    it('strips the leading tabs of a <<- heredoc', () => {
      // Act & Assert
      assertEquals(wordsOf('echo "$(cat <<-\'EOF\'\n\tline\n\tEOF\n)"'), [[literal('cat')], [literal('echo'), literal('line')]])
    })

    it('ends a heredoc whose terminator closes the substitution on the same line', () => {
      // Act & Assert
      assertEquals(wordsOf('echo "$(cat <<\'EOF\'\nline\nEOF)" next'), [[literal('cat')], [literal('echo'), literal('line'), literal('next')]])
    })
  })

  describe('redirectPattern', () => {
    it('matches the longest operator at the start', () => {
      // Act & Assert
      assertEquals(captures('<<- EOF', redirectPattern), ['<<-', '<<-'])
      assertEquals(captures('>>log', redirectPattern), ['>>', '>>'])
      assertEquals(captures('<<<word', redirectPattern), ['<<<', '<<<'])
    })

    it('refuses text that does not start with an operator', () => {
      // Act & Assert
      assertEquals(redirectPattern.test('a>b'), false)
    })
  })

  describe('parameterPattern', () => {
    it('matches a name or a special parameter', () => {
      // Act & Assert
      assertEquals(captures('HOME/x', parameterPattern), ['HOME', 'HOME'])
      assertEquals(captures('?x', parameterPattern), ['?', '?'])
    })

    it('refuses a space or a newline, which leave a lone dollar sign as text', () => {
      // Act & Assert
      assertEquals(parameterPattern.test(' x'), false)
      assertEquals(parameterPattern.test('\nx'), false)
    })
  })

  describe('descriptorPattern', () => {
    it('matches a run of digits', () => {
      // Act & Assert
      assertEquals(descriptorPattern.test('2'), true)
    })

    it('refuses a word with other characters, which is an argument', () => {
      // Act & Assert
      assertEquals(descriptorPattern.test('2a'), false)
      assertEquals(descriptorPattern.test('2\n'), false)
    })
  })

  describe('leadingTabsPattern', () => {
    it('matches the tabs at the start of a line', () => {
      // Act & Assert
      assertEquals(captures('\t\tEOF', leadingTabsPattern), ['\t\t'])
    })

    it('refuses leading spaces, which <<- keeps', () => {
      // Act & Assert
      assertEquals(leadingTabsPattern.test('  EOF'), false)
    })
  })

  describe('expansionPattern', () => {
    it('matches a dollar sign or a backtick', () => {
      // Act & Assert
      assertEquals(expansionPattern.test('cost $x'), true)
      assertEquals(expansionPattern.test('`date`'), true)
    })

    it('refuses text with neither', () => {
      // Act & Assert
      assertEquals(expansionPattern.test('plain text\n'), false)
    })
  })
})
