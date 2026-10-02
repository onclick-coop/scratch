import { assertEquals, assertStringIncludes } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { failClosed, ghWordPattern, runHook } from './hook.ts'

const CONFIG = '{ "tagline": { "text": "> _Generated with Claude_" } }'
const signedBody = 'Prose.\n\n> _Generated with Claude_\n'

const payload = (fields: Record<string, unknown>): string => JSON.stringify({ hook_event_name: 'PreToolUse', ...fields })

const bash = (command: string, cwd: string): string => payload({ tool_name: 'Bash', tool_input: { command }, cwd })

const configAt = (configs: Record<string, string>) => {
  return (directory: string): Promise<string> => Promise.resolve(configs[directory] ?? '{}')
}

const unreachableConfig = (): Promise<string> => Promise.reject(new Error('the config was read'))

const unset = (): undefined => undefined

const ungranted = (): string => {
  throw new CliError('The hook command cannot read CLAUDE_PROJECT_DIR', ['Add --allow-env=CLAUDE_PROJECT_DIR to the hook command'])
}

const fileReader = (files: Record<string, string>) => {
  return (path: string): string => {
    const contents = files[path]

    if (contents === undefined) {
      throw new Error('No such file or directory')
    }

    return contents
  }
}

describe('All Tagline Hook Tests', () => {
  describe('allowed without reading the config', () => {
    it('allows a command that writes no GitHub body', async () => {
      // Act
      const result = await runHook({ raw: bash('ls -la && gh pr list', '/work/p'), readProjectDir: unset, readConfig: unreachableConfig, readFile: fileReader({}) })

      // Assert
      assertEquals(result, { code: 0, message: '' })
    })

    it('allows a call to another tool, even one whose input names a body write', async () => {
      // Arrange
      const raw = payload({ tool_name: 'Edit', tool_input: { command: 'gh issue create --body x' }, cwd: '/work/p' })

      // Act
      const result = await runHook({ raw, readProjectDir: unset, readConfig: unreachableConfig, readFile: fileReader({}) })

      // Assert
      assertEquals(result, { code: 0, message: '' })
    })

    it('allows input that is not JSON', async () => {
      // Act
      const result = await runHook({ raw: 'not json', readProjectDir: unset, readConfig: unreachableConfig, readFile: fileReader({}) })

      // Assert
      assertEquals(result, { code: 0, message: '' })
    })

    it('allows a command that writes no body when the hook cannot read the project directory', async () => {
      // Act
      const result = await runHook({ raw: bash('git status', '/work/p'), readProjectDir: ungranted, readConfig: unreachableConfig, readFile: fileReader({}) })

      // Assert
      assertEquals(result, { code: 0, message: '' })
    })

    it('allows a command that writes no body when the payload names no cwd', async () => {
      // Arrange
      const raw = payload({ tool_name: 'Bash', tool_input: { command: 'git status' } })

      // Act
      const result = await runHook({ raw, readProjectDir: unset, readConfig: unreachableConfig, readFile: fileReader({}) })

      // Assert
      assertEquals(result, { code: 0, message: '' })
    })
  })

  describe('blocked when the check cannot run', () => {
    it('blocks a body write when the project sets no tagline, naming the problem and the shape to write', async () => {
      // Arrange
      const raw = bash("gh issue comment 4 --body 'Prose.'", '/work/p')

      // Act
      const result = await runHook({ raw, readProjectDir: unset, readConfig: configAt({}), readFile: fileReader({}) })

      // Assert
      assertEquals(result, {
        code: 2,
        message: [
          'Blocked: this gh command writes a GitHub body, and the tagline check cannot run to verify it.',
          '',
          'error: tools.config.json gives no tagline the tool can read: \u{2716} text is required, since the tool has no tagline of its own',
          '  \u{2192} at text',
          '  - Write it as { "tagline": { "text": "<the line every body ends with>", "stale": ["<an older spelling to strip>"] } }',
          '',
          'Fix the setup, then re-run the command.',
        ].join('\n'),
      })
    })

    it('blocks a body write when the config is not valid JSON', async () => {
      // Arrange
      const raw = bash('gh pr create --body-file /work/p/body.md', '/work/p')

      // Act
      const result = await runHook({ raw, readProjectDir: unset, readConfig: configAt({ '/work/p': '{ bad' }), readFile: fileReader({}) })

      // Assert
      assertEquals(result.code, 2)
      assertStringIncludes(result.message, 'error: tools.config.json is not valid JSON')
      assertStringIncludes(result.message, '  - Write it as { "tagline": { "text": "<the line every body ends with>", "stale": ["<an older spelling to strip>"] } }')
    })

    it('blocks a body write when the config cannot be read, without suggesting defaults the hook does not have', async () => {
      // Arrange
      const raw = bash("gh issue comment 4 --body 'Prose.'", '/work/p')
      const readConfig = (): Promise<string> => Promise.reject(new CliError('Failed to read /work/p/tools.config.json: Permission denied', ['Make it a readable file, or remove it to use the defaults']))

      // Act
      const result = await runHook({ raw, readProjectDir: unset, readConfig, readFile: fileReader({}) })

      // Assert
      assertEquals(result, {
        code: 2,
        message: [
          'Blocked: this gh command writes a GitHub body, and the tagline check cannot run to verify it.',
          '',
          'error: Failed to read /work/p/tools.config.json: Permission denied',
          '  - Make tools.config.json a readable file, since the hook has no defaults to fall back to',
          '',
          'Fix the setup, then re-run the command.',
        ].join('\n'),
      })
    })

    it('blocks a body write when the payload names no cwd', async () => {
      // Arrange
      const raw = payload({ tool_name: 'Bash', tool_input: { command: "gh issue close 8 --comment 'Done'" } })

      // Act
      const result = await runHook({ raw, readProjectDir: unset, readConfig: configAt({}), readFile: fileReader({}) })

      // Assert
      assertEquals(result.code, 2)
      assertStringIncludes(result.message, 'error: The hook payload names no cwd')
    })

    it('blocks a body write when the hook cannot read the project directory, naming the missing grant', async () => {
      // Arrange
      const raw = bash("gh issue comment 4 --body 'Prose.'", '/work/p')

      // Act
      const result = await runHook({ raw, readProjectDir: ungranted, readConfig: configAt({ '/work/p': CONFIG }), readFile: fileReader({}) })

      // Assert
      assertEquals(result.code, 2)
      assertStringIncludes(result.message, ['error: The hook command cannot read CLAUDE_PROJECT_DIR', '  - Add --allow-env=CLAUDE_PROJECT_DIR to the hook command'].join('\n'))
    })

    it('blocks a body write on a failure the hook cannot classify, rather than letting it through', async () => {
      // Arrange
      const raw = bash("gh issue comment 4 --body 'Prose.'", '/work/p')
      const readProjectDir = (): string => {
        throw new TypeError('unexpected')
      }

      // Act
      const result = await runHook({ raw, readProjectDir, readConfig: configAt({ '/work/p': CONFIG }), readFile: fileReader({}) })

      // Assert
      assertEquals(result.code, 2)
      assertStringIncludes(result.message, 'error: unexpected')
    })
  })

  describe('failClosed', () => {
    it('blocks a payload whose command writes a body', () => {
      // Act
      const failure = failClosed(bash("gh issue comment 4 --body 'Prose.'", '/work/p'), new Error('boom'))

      // Assert
      assertEquals(failure, {
        code: 2,
        message: ['Blocked: this gh command may write a GitHub body, and the tagline check failed before it could verify it.', '', 'error: boom'].join('\n'),
      })
    })

    it('blocks a payload naming gh when the parser itself crashes on it', () => {
      // Arrange
      const command = 'gh issue comment 1 --body ' + '$('.repeat(5000)

      // Act
      const failure = failClosed(bash(command, '/work/p'), new RangeError('Maximum call stack size exceeded'))

      // Assert
      assertEquals(failure.code, 2)
    })

    it('passes a payload whose command writes no body as a non-blocking error', () => {
      // Act
      const failure = failClosed(bash('ls -la', '/work/p'), new Error('boom'))

      // Assert
      assertEquals(failure, { code: 1, message: 'error: boom' })
    })

    it('passes a payload that is not a Bash call, listing the suggestions of a CLI error', () => {
      // Act
      const failure = failClosed('not json', new CliError('Unknown option: "--x"', ['tagline takes no option but --help']))

      // Assert
      assertEquals(failure, { code: 1, message: ['error: Unknown option: "--x"', '  - tagline takes no option but --help'].join('\n') })
    })
  })

  describe('ghWordPattern', () => {
    it('matches gh as a command name, a path tail, or the start of a quoted script', () => {
      // Act & Assert
      assertEquals(ghWordPattern.test('gh issue create'), true)
      assertEquals(ghWordPattern.test('x; /usr/bin/gh pr comment'), true)
      assertEquals(ghWordPattern.test("bash -c 'gh issue comment'"), true)
    })

    it('refuses gh inside a longer word, such as a branch name or another command', () => {
      // Act & Assert
      assertEquals(ghWordPattern.test('git push origin gh-pages'), false)
      assertEquals(ghWordPattern.test('ghost && high'), false)
    })
  })

  describe('checked against the project config', () => {
    it('allows a body carrying the tagline', async () => {
      // Arrange
      const raw = bash('gh issue create --body-file /work/p/body.md', '/work/p')

      // Act
      const result = await runHook({ raw, readProjectDir: unset, readConfig: configAt({ '/work/p': CONFIG }), readFile: fileReader({ '/work/p/body.md': signedBody }) })

      // Assert
      assertEquals(result, { code: 0, message: '' })
    })

    it('blocks a body missing the tagline with the violation message', async () => {
      // Arrange
      const raw = bash("gh issue comment 4 --body 'Prose.'", '/work/p')

      // Act
      const result = await runHook({ raw, readProjectDir: unset, readConfig: configAt({ '/work/p': CONFIG }), readFile: fileReader({}) })

      // Assert
      assertEquals(result.code, 2)
      assertStringIncludes(result.message, '  - gh issue comment: the inline body passed to --body does not end with the tagline')
    })

    it('reads the config from the project directory over a subdirectory the session moved into', async () => {
      // Arrange
      const raw = bash('gh issue create --body-file body.md', '/work/p/docs')

      // Act
      const result = await runHook({ raw, readProjectDir: () => '/work/p', readConfig: configAt({ '/work/p': CONFIG }), readFile: fileReader({ '/work/p/docs/body.md': signedBody }) })

      // Assert
      assertEquals(result, { code: 0, message: '' })
    })

    it("falls back to the payload's cwd when the project directory is empty", async () => {
      // Arrange
      const raw = bash('gh issue create --body-file /work/p/body.md', '/work/p')

      // Act
      const result = await runHook({ raw, readProjectDir: () => '', readConfig: configAt({ '/work/p': CONFIG }), readFile: fileReader({ '/work/p/body.md': signedBody }) })

      // Assert
      assertEquals(result, { code: 0, message: '' })
    })

    it("reads a relative body file from the payload's cwd, where gh resolves it, rather than the project directory", async () => {
      // Arrange
      const raw = bash('gh issue create --body-file body.md', '/work/p/docs')
      const readFile = fileReader({ '/work/p/body.md': signedBody })

      // Act
      const result = await runHook({ raw, readProjectDir: () => '/work/p', readConfig: configAt({ '/work/p': CONFIG }), readFile })

      // Assert
      assertEquals(result.code, 2)
      assertStringIncludes(result.message, 'could not read the body file "body.md"')
    })
  })
})
