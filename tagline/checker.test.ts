import { assertEquals, assertStringIncludes } from '@std/assert'
import { describe, it } from 'node:test'
import { checkFindings, formatViolations, type Violation } from './checker.ts'
import { findBodyWrites } from './parser.ts'

const TAGLINE = '> _Generated with Claude_'
const signedBody = `## Summary\n\nSome prose.\n\n${TAGLINE}\n`
const unsignedBody = '## Summary\n\nSome prose.\n'

const inlineViolation: Violation = {
  subcommand: 'issue comment',
  flag: '--body',
  reason: 'missing-tagline',
  detail: 'the inline body passed to --body does not end with the tagline',
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

describe('All Tagline Checker Tests', () => {
  describe('inline bodies', () => {
    it('allows an inline body carrying the tagline', () => {
      // Arrange
      const command = `gh issue comment 4 --body '${signedBody}'`

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [])
    })

    it('blocks an inline body missing the tagline', () => {
      // Arrange
      const command = `gh issue comment 4 --body '${unsignedBody}'`

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'issue comment',
        flag: '--body',
        reason: 'missing-tagline',
        detail: 'the inline body passed to --body does not end with the tagline',
      }])
    })

    it('blocks a close comment missing the tagline', () => {
      // Arrange
      const command = `gh issue close 8 --comment 'Fixed in main'`

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'issue close',
        flag: '--comment',
        reason: 'missing-tagline',
        detail: 'the inline body passed to --comment does not end with the tagline',
      }])
    })

    it('allows a heredoc inline body carrying the tagline', () => {
      // Arrange
      const command = `gh issue create --title "x" --body "$(cat <<'EOF'\n## Summary\n\nProse.\n\n${TAGLINE}\nEOF\n)"`

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [])
    })

    it('blocks a heredoc inline body missing the tagline', () => {
      // Arrange
      const command = `gh issue create --title "x" --body "$(cat <<'EOF'\n## Summary\n\nProse.\nEOF\n)"`

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations.length, 1)
    })

    it('checks against the tagline it is given rather than a built-in one', () => {
      // Arrange
      const command = `gh pr comment 2 --body 'Prose.\n\n${TAGLINE}'`

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: 'Drafted by an agent', readFile: fileReader({}) })

      // Assert
      assertEquals(violations.length, 1)
    })
  })

  describe('body files', () => {
    it('allows a body file carrying the tagline', () => {
      // Arrange
      const command = 'gh issue create --body-file /tmp/body.md'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/body.md': signedBody }) })

      // Assert
      assertEquals(violations, [])
    })

    it('blocks a body file missing the tagline', () => {
      // Arrange
      const command = 'gh issue create --body-file /tmp/body.md'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/body.md': unsignedBody }) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'issue create',
        flag: '--body-file',
        reason: 'missing-tagline',
        detail: 'the body file "/tmp/body.md" does not end with the tagline',
      }])
    })

    it('blocks an unreadable body file', () => {
      // Arrange
      const command = 'gh issue create --body-file /tmp/missing.md'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'issue create',
        flag: '--body-file',
        reason: 'unreadable-file',
        detail: 'could not read the body file "/tmp/missing.md": No such file or directory',
      }])
    })

    it('allows an api body field file carrying the tagline', () => {
      // Arrange
      const command = 'gh api -X PATCH repos/o/r/issues/comments/5 -F body=@/tmp/b.md'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/b.md': signedBody }) })

      // Assert
      assertEquals(violations, [])
    })

    it('blocks an api body field file missing the tagline', () => {
      // Arrange
      const command = 'gh api -X PATCH repos/o/r/issues/comments/5 -F body=@/tmp/b.md'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/b.md': unsignedBody }) })

      // Assert
      assertEquals(violations.length, 1)
    })

    it('blocks a body file whose tagline shares a line with the prose', () => {
      // Arrange
      const command = 'gh issue create --body-file /tmp/b.md'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/b.md': `Prose. ${TAGLINE}\n` }) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'issue create',
        flag: '--body-file',
        reason: 'missing-tagline',
        detail: 'the body file "/tmp/b.md" does not end with the tagline',
      }])
    })
  })

  describe('api input files', () => {
    it('allows an input file whose body carries the tagline', () => {
      // Arrange
      const command = 'gh api repos/o/r/issues --input /tmp/in.json'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/in.json': JSON.stringify({ title: 't', body: signedBody }) }) })

      // Assert
      assertEquals(violations, [])
    })

    it('blocks an input file whose body lacks the tagline', () => {
      // Arrange
      const command = 'gh api repos/o/r/issues --input /tmp/in.json'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/in.json': JSON.stringify({ body: unsignedBody }) }) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'api',
        flag: '--input',
        reason: 'missing-tagline',
        detail: 'the body in the --input file "/tmp/in.json" does not end with the tagline',
      }])
    })

    it('allows an input file that sets no body, such as one closing an issue', () => {
      // Arrange
      const command = 'gh api -X PATCH repos/o/r/issues/1 --input /tmp/in.json'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/in.json': '{ "state": "closed" }' }) })

      // Assert
      assertEquals(violations, [])
    })

    it('blocks an input file that is not a JSON object with a string body', () => {
      // Arrange
      const command = 'gh api repos/o/r/issues --input /tmp/in.json'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/in.json': 'body: hi' }) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'api',
        flag: '--input',
        reason: 'unreadable-file',
        detail: 'the --input file "/tmp/in.json" is not a JSON object with a string body',
      }])
    })
  })

  describe('bodies the hook cannot check', () => {
    it('blocks a body built by command substitution as built at run time rather than as missing the tagline', () => {
      // Arrange
      const command = 'gh issue comment 4 --body "$(cat notes.md)"'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'issue comment',
        flag: '--body',
        reason: 'runtime-body',
        detail: 'the body passed to --body is built at run time, so it cannot be checked',
      }])
    })

    it('allows a body built at run time whose literal ending is the tagline', () => {
      // Arrange
      const command = `gh issue comment 4 --body "Fixed in $(git rev-parse HEAD).\n\n${TAGLINE}"`

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [])
    })

    it('blocks a body file path built at run time', () => {
      // Arrange
      const command = 'gh issue create --body-file "$F"'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'issue create',
        flag: '--body-file',
        reason: 'runtime-body',
        detail: 'the body passed to --body-file is built at run time, so it cannot be checked',
      }])
    })

    it('blocks a GraphQL mutation passing a body', () => {
      // Arrange
      const command = `gh api graphql -f query='mutation { addComment(input: {subjectId: "x", body: "hi"}) { clientMutationId } }'`

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'api graphql',
        flag: '-f query',
        reason: 'graphql-body',
        detail: 'the GraphQL mutation writes a body the hook cannot check reliably',
      }])
    })

    it('blocks a GraphQL query file holding a mutation that passes a body', () => {
      // Arrange
      const command = 'gh api graphql -F query=@/tmp/q.graphql -f body=hi'
      const readFile = fileReader({ '/tmp/q.graphql': 'mutation($body: String!) { addComment(input: {subjectId: "x", body: $body}) { clientMutationId } }' })

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile })

      // Assert
      assertEquals(violations, [{
        subcommand: 'api graphql',
        flag: '-F query',
        reason: 'graphql-body',
        detail: 'the GraphQL mutation in "/tmp/q.graphql" writes a body the hook cannot check reliably',
      }])
    })

    it('allows a GraphQL query file that only reads', () => {
      // Arrange
      const command = 'gh api graphql -F query=@/tmp/q.graphql'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/q.graphql': 'query { viewer { login } }' }) })

      // Assert
      assertEquals(violations, [])
    })
  })

  describe('stdin bodies', () => {
    it('blocks a stdin-piped body as unverifiable', () => {
      // Arrange
      const command = 'cat /tmp/b.md | gh issue create --body-file -'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [{
        subcommand: 'issue create',
        flag: '--body-file',
        reason: 'stdin-body',
        detail: 'the body is piped from stdin, which cannot be verified before the command runs',
      }])
    })
  })

  describe('passthrough', () => {
    it('allows a command with no gh invocation', () => {
      // Arrange
      const command = 'deno task test && git commit -m "feat: add thing"'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [])
    })

    it('allows read-only gh commands', () => {
      // Arrange
      const command = 'gh issue view 4 && gh run watch && gh pr list'

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({}) })

      // Assert
      assertEquals(violations, [])
    })

    it('allows a labels-only edit chained with a signed comment', () => {
      // Arrange
      const command = `gh issue edit 4 --add-label bug && gh issue comment 4 --body-file /tmp/b.md`

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile: fileReader({ '/tmp/b.md': signedBody }) })

      // Assert
      assertEquals(violations, [])
    })

    it('blocks only the offending segment in a multi-command line', () => {
      // Arrange
      const command = `gh issue comment 1 --body-file /tmp/good.md && gh issue comment 2 --body-file /tmp/bad.md`
      const readFile = fileReader({ '/tmp/good.md': signedBody, '/tmp/bad.md': unsignedBody })

      // Act
      const violations = checkFindings({ findings: findBodyWrites(command, '/work/p'), tagline: TAGLINE, readFile })

      // Assert
      assertEquals(violations, [{
        subcommand: 'issue comment',
        flag: '--body-file',
        reason: 'missing-tagline',
        detail: 'the body file "/tmp/bad.md" does not end with the tagline',
      }])
    })
  })

  describe('formatViolations', () => {
    it('names the tagline and the fix', () => {
      // Act
      const message = formatViolations([inlineViolation], { text: TAGLINE, stale: [] })

      // Assert
      assertEquals(
        message,
        [
          'Blocked: this gh command writes a GitHub body that is missing the attribution tagline.',
          '',
          '  - gh issue comment: the inline body passed to --body does not end with the tagline',
          '',
          'Every AI-authored issue body, PR body, and substantive comment must end with:',
          '',
          '    > _Generated with Claude_',
          '',
          'on its own line, separated from the preceding content by a blank line.',
          'Append it to the body (stripping any stale tagline first), then re-run the command.',
        ].join('\n'),
      )
    })

    it('lists the stale spellings to strip when the config names any', () => {
      // Act
      const message = formatViolations([inlineViolation], { text: TAGLINE, stale: ['_Generated by Claude_', '_generated by claude_'] })

      // Assert
      assertStringIncludes(
        message,
        [
          'Append it to the body (stripping any stale tagline first), then re-run the command.',
          '',
          'Stale taglines to strip:',
          '',
          '    _Generated by Claude_',
          '    _generated by claude_',
        ].join('\n'),
      )
    })

    it('suggests body-file for a stdin body, without claiming it as any one project convention', () => {
      // Arrange
      const violation: Violation = {
        subcommand: 'issue create',
        flag: '--body-file',
        reason: 'stdin-body',
        detail: 'the body is piped from stdin, which cannot be verified before the command runs',
      }

      // Act
      const message = formatViolations([violation], { text: TAGLINE, stale: [] })

      // Assert
      assertStringIncludes(
        message,
        [
          '',
          'For stdin-piped bodies: write the body to a file and pass --body-file <path> instead, so the hook can read it before the command runs.',
        ].join('\n'),
      )
    })

    it('heads a block of bodies built at run time as uncheckable rather than missing, and says how to pass them', () => {
      // Arrange
      const violation: Violation = {
        subcommand: 'issue comment',
        flag: '--body',
        reason: 'runtime-body',
        detail: 'the body passed to --body is built at run time, so it cannot be checked',
      }

      // Act
      const message = formatViolations([violation], { text: TAGLINE, stale: [] })

      // Assert
      assertEquals(
        message,
        [
          'Blocked: this gh command writes a GitHub body the hook cannot check.',
          '',
          '  - gh issue comment: the body passed to --body is built at run time, so it cannot be checked',
          '',
          'Every AI-authored issue body, PR body, and substantive comment must end with:',
          '',
          '    > _Generated with Claude_',
          '',
          'on its own line, separated from the preceding content by a blank line.',
          'Append it to the body (stripping any stale tagline first), then re-run the command.',
          '',
          'For bodies built at run time: write the body to a file in an earlier step, then pass --body-file <path>, so the hook can read it before the command runs.',
        ].join('\n'),
      )
    })

    it('points a GraphQL mutation at the REST commands', () => {
      // Arrange
      const violation: Violation = {
        subcommand: 'api graphql',
        flag: '-f query',
        reason: 'graphql-body',
        detail: 'the GraphQL mutation writes a body the hook cannot check reliably',
      }

      // Act
      const message = formatViolations([violation], { text: TAGLINE, stale: [] })

      // Assert
      assertStringIncludes(message, '\n\nFor GraphQL mutations: post the body through a REST command instead, such as gh issue comment or gh pr review with --body-file.')
    })
  })
})
