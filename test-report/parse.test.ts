import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { errorHeaderPattern, errorsHeaderPattern, failuresHeaderPattern, parseTestOutput, stepPattern, summaryPattern } from './parse.ts'

const PASSING = [
  'running 1 test from ./sample.test.ts',
  'All Sample Tests ...',
  '  group ...',
  '    passes ... ok (1ms)',
  'All Sample Tests ... ok (3ms)',
  '',
  'ok | 1 passed (1 step) | 0 failed (4ms)',
  '',
].join('\n')

const FAILING = [
  'running 1 test from ./sample.test.ts',
  'All Sample Tests ...',
  '  group ...',
  '    passes ... ok (1ms)',
  '    fails ... FAILED (17ms)',
  '    ignored one ... ignored (0ms)',
  '  group ... FAILED (due to 1 failed step) (19ms)',
  'All Sample Tests ... FAILED (due to 1 failed step) (20ms)',
  '',
  ' ERRORS ',
  '',
  'All Sample Tests ... group ... fails => https://jsr.io/@std/testing/1.0.19/_test_suite.ts:402:15',
  'error: AssertionError: Values are not equal.',
  '    at assertEquals (https://jsr.io/@std/assert/1.0.19/equals.ts:67:9)',
  '',
  ' FAILURES ',
  '',
  'All Sample Tests ... group ... fails => https://jsr.io/@std/testing/1.0.19/_test_suite.ts:402:15',
  '',
  'FAILED | 0 passed (1 step) | 1 failed (2 steps) | 0 ignored (1 step) (21ms)',
  '',
].join('\n')

// Output deno 2.9 printed for a node:test file with two failures, colour escapes and the file path aside.
const NODE_FAILING = [
  'Check sample.test.ts',
  'running 1 test from ./sample.test.ts',
  'Outer ...',
  '  inner ...',
  '    passes ... ok (1ms)',
  '    fails one ... FAILED (10ms)',
  '  inner ... FAILED (due to 1 failed step) (11ms)',
  '  fails two ... FAILED (1ms)',
  'Outer ... FAILED (due to 2 failed steps) (13ms)',
  '',
  ' ERRORS ',
  '',
  'Outer ... inner ... fails one => ext:deno_node/testing.ts:1:21231',
  'error: AssertionError: Values are not equal.',
  '',
  '',
  '    [Diff] Actual / Expected',
  '',
  '',
  '-   1',
  '+   2',
  '',
  '  throw new AssertionError(message);',
  '        ^',
  '    at assertEquals (https://jsr.io/@std/assert/1.0.19/equals.ts:67:9)',
  '    at NodeTestContext.<anonymous> (file:///work/sample.test.ts:11:7)',
  '',
  'Outer ... fails two => ext:deno_node/testing.ts:1:21231',
  'error: Error: second',
  "    throw new Error('second')",
  '          ^',
  '    at NodeTestContext.<anonymous> (file:///work/sample.test.ts:16:11)',
  '',
  ' FAILURES ',
  '',
  'Outer ... inner ... fails one => ext:deno_node/testing.ts:1:21231',
  'Outer ... fails two => ext:deno_node/testing.ts:1:21231',
  '',
  'FAILED | 0 passed (1 step) | 1 failed (3 steps) (18ms)',
  '',
  'error: Test failed',
  '',
].join('\n')

// Output deno 2.9 printed for a node:test failure whose message holds lines shaped like error headers.
const PHANTOM_HEADERS = [
  'Check sample.test.ts',
  'running 1 test from ./sample.test.ts',
  'Outer ...',
  '  fails with a message ... FAILED (1ms)',
  'Outer ... FAILED (due to 1 failed step) (2ms)',
  '',
  ' ERRORS ',
  '',
  'Outer ... fails with a message => ext:deno_node/testing.ts:1:23191',
  'error: Error: first line',
  'fake test => fake.ts:1:2',
  '',
  'other => more.ts:3:4',
  "    throw new Error('first line\\nfake test => fake.ts:1:2\\n\\nother => more.ts:3:4')",
  '          ^',
  '    at NodeTestContext.<anonymous> (file:///work/sample.test.ts:5:11)',
  '',
  ' FAILURES ',
  '',
  'Outer ... fails with a message => ext:deno_node/testing.ts:1:23191',
  '',
  'FAILED | 0 passed | 1 failed (1 step) (8ms)',
  '',
  'error: Test failed',
  '',
].join('\n')

// Output deno 2.9 printed for an error thrown from a timer after its test returned.
const UNCAUGHT = [
  'Check async.test.ts',
  'running 2 tests from ./async.test.ts',
  'leaks ... ok (15ms)',
  'after ...',
  'Uncaught error from ./async.test.ts FAILED',
  'after ... cancelled (0ms)',
  '',
  ' ERRORS ',
  '',
  './async.test.ts (uncaught error)',
  'error: Error: late',
  "    throw new Error('late')",
  '          ^',
  '    at Timeout._onTimeout (file:///work/async.test.ts:3:11)',
  'This error was not caught from a test and caused the test runner to fail on the referenced module.',
  'It most likely originated from a dangling promise, event/timeout handler or top-level code.',
  '',
  ' FAILURES ',
  '',
  './async.test.ts (uncaught error)',
  '',
  'FAILED | 1 passed | 2 failed (24ms)',
  '',
  'error: Test failed',
  '',
].join('\n')

describe('All Test Report Parser Tests', () => {
  describe('stepPattern', () => {
    it('captures the name, the status, and the duration of a step', () => {
      // Act
      const match = stepPattern.exec('    passes ... ok (1ms)')

      // Assert
      assertEquals(match?.[2], 'passes')
      assertEquals(match?.[3], 'ok')
      assertEquals(match?.[4], '1')
      assertEquals(match?.[5], 'ms')
    })

    it('captures a duration given in seconds', () => {
      // Act
      const match = stepPattern.exec('  slow one ... ok (10s)')

      // Assert
      assertEquals(match?.[4], '10')
      assertEquals(match?.[5], 's')
    })

    it('matches each status a step can carry', () => {
      // Act & Assert
      assertEquals(stepPattern.exec('  a ... FAILED (2ms)')?.[3], 'FAILED')
      assertEquals(stepPattern.exec('  a ... ignored (0ms)')?.[3], 'ignored')
    })

    it('refuses an aggregate line, whose `(due to ...)` suffix is not a duration', () => {
      // Act
      const match = stepPattern.exec('  group ... FAILED (due to 1 failed step) (19ms)')

      // Assert
      assertEquals(match, null)
    })

    it('refuses a line that is not a step', () => {
      // Act & Assert
      assertEquals(stepPattern.exec('running 1 test from ./sample.test.ts'), null)
      assertEquals(stepPattern.exec(''), null)
    })
  })

  describe('summaryPattern', () => {
    it('captures the passed and failed counts', () => {
      // Act
      const match = summaryPattern.exec('ok | 22 passed (414 steps) | 0 failed (1s)')

      // Assert
      assertEquals(match?.[2], '22')
      assertEquals(match?.[3], '0')
    })

    it('matches a singular step count, which deno prints when a file has exactly one', () => {
      // Act
      const match = summaryPattern.exec('ok | 1 passed (1 step) | 0 failed (300ms)')

      // Assert
      assertEquals(match?.[2], '1')
      assertEquals(match?.[3], '0')
    })

    it('matches a line carrying an ignored count', () => {
      // Act
      const match = summaryPattern.exec('FAILED | 0 passed (1 step) | 1 failed (2 steps) | 0 ignored (1 step) (21ms)')

      // Assert
      assertEquals(match?.[2], '0')
      assertEquals(match?.[3], '1')
    })

    it('matches a line with no step counts at all', () => {
      // Act
      const match = summaryPattern.exec('ok | 3 passed | 0 failed (120ms)')

      // Assert
      assertEquals(match?.[2], '3')
    })

    it('matches a run measured in minutes, which deno prints as `XmYs`', () => {
      // Act
      const match = summaryPattern.exec('ok | 1 passed (1 step) | 0 failed (1m5s)')

      // Assert
      assertEquals(match?.[2], '1')
    })

    it('matches a tail deno words differently, such as a filtered-out count', () => {
      // Act
      const match = summaryPattern.exec('ok | 1 passed | 0 failed | 2 filtered out (1ms)')

      // Assert
      assertEquals(match?.[2], '1')
    })

    it('refuses a step line, which also carries a duration in parentheses', () => {
      // Act & Assert
      assertEquals(summaryPattern.exec('    passes ... ok (1ms)'), null)
    })
  })

  describe('errorsHeaderPattern', () => {
    it('matches the ERRORS banner with the padding deno prints around it', () => {
      // Act & Assert
      assertEquals(errorsHeaderPattern.test(' ERRORS '), true)
    })

    it('refuses a line that merely mentions errors', () => {
      // Act & Assert
      assertEquals(errorsHeaderPattern.test('error: AssertionError'), false)
      assertEquals(errorsHeaderPattern.test('2 ERRORS found'), false)
    })
  })

  describe('failuresHeaderPattern', () => {
    it('matches the FAILURES banner with the padding deno prints around it', () => {
      // Act & Assert
      assertEquals(failuresHeaderPattern.test(' FAILURES '), true)
    })

    it('refuses a line that merely mentions failures', () => {
      // Act & Assert
      assertEquals(failuresHeaderPattern.test('FAILURES in 2 files'), false)
    })
  })

  describe('errorHeaderPattern', () => {
    it('captures the test name from a node:test header, which points at deno internals', () => {
      // Act
      const match = errorHeaderPattern.exec('Outer ... inner ... fails one => ext:deno_node/testing.ts:1:21231')

      // Assert
      assertEquals(match?.[1], 'Outer ... inner ... fails one')
    })

    it('captures the test name from an @std/testing header, which points at the jsr url', () => {
      // Act
      const match = errorHeaderPattern.exec('All Sample Tests ... group ... fails => https://jsr.io/@std/testing/1.0.19/_test_suite.ts:402:15')

      // Assert
      assertEquals(match?.[1], 'All Sample Tests ... group ... fails')
    })

    it('captures the test name from a Deno.test header, which points at the test file', () => {
      // Act
      const match = errorHeaderPattern.exec('adds two numbers => ./math.test.ts:3:6')

      // Assert
      assertEquals(match?.[1], 'adds two numbers')
    })

    it('keeps an arrow inside the test name, since the location after the last arrow carries no space', () => {
      // Act
      const match = errorHeaderPattern.exec('maps a => b => ./map.test.ts:3:6')

      // Assert
      assertEquals(match?.[1], 'maps a => b')
    })

    it('refuses a stack frame, which deno indents under the error', () => {
      // Act & Assert
      assertEquals(errorHeaderPattern.test('    at assertEquals (https://jsr.io/@std/assert/1.0.19/equals.ts:67:9)'), false)
    })

    it('refuses an uncaught error header, which names the module with no arrow', () => {
      // Act & Assert
      assertEquals(errorHeaderPattern.test('./async.test.ts (uncaught error)'), false)
    })

    it('refuses a header with no line and column after the location', () => {
      // Act & Assert
      assertEquals(errorHeaderPattern.test('Outer ... fails => ext:deno_node/testing.ts'), false)
    })

    it('refuses a header broken across lines, since the name and location stay on one', () => {
      // Act & Assert
      assertEquals(errorHeaderPattern.test('Outer ... fails\n=> ext:deno_node/testing.ts:1:2'), false)
      assertEquals(errorHeaderPattern.test('Outer ... fails => ext:deno_node/testing.ts:1:2\nerror: x'), false)
    })
  })

  describe('parseTestOutput', () => {
    it('reports a zero exit as a pass', () => {
      // Act
      const report = parseTestOutput('a.test.ts', PASSING, 0, 500)

      // Assert
      assertEquals(report.status, 'pass')
    })

    it('reads the counts from a summary whose step counts are singular', () => {
      // Act
      const report = parseTestOutput('a.test.ts', PASSING, 0, 500)

      // Assert
      assertEquals(report.passed, 1)
    })

    it('reports a non-zero exit with failures as a fail', () => {
      // Act
      const report = parseTestOutput('a.test.ts', FAILING, 1, 500)

      // Assert
      assertEquals(report.status, 'fail')
      assertEquals(report.failed, 1)
    })

    it('reports a non-zero exit with no failure summary as a crash', () => {
      // Act
      const report = parseTestOutput('a.test.ts', 'error: Uncaught SyntaxError', 1, 500)

      // Assert
      assertEquals(report.status, 'crash')
    })

    it('reports a fail from a failed count alone, with no error headers to read', () => {
      // Act
      const report = parseTestOutput('a.test.ts', 'FAILED | 1 passed | 2 failed (24ms)\n\nerror: Test failed\n', 1, 500)

      // Assert
      assertEquals(report.status, 'fail')
      assertEquals(report.failed, 2)
      assertEquals(report.failures, [])
    })

    it('reports a fail from error headers alone, when the output stops before the summary line', () => {
      // Arrange
      const raw = [' ERRORS ', '', 'a fails => ./a.test.ts:1:6', 'error: Error: nope', '', ' FAILURES ', '', 'a fails => ./a.test.ts:1:6', ''].join('\n')

      // Act
      const report = parseTestOutput('a.test.ts', raw, 1, 500)

      // Assert
      assertEquals(report.status, 'fail')
      assertEquals(report.failed, 0)
      assertEquals(report.failures, [{ step: 'a fails', errorBlock: 'error: Error: nope' }])
    })

    it('reads a line of an error message shaped like a header as part of the message, since FAILURES never lists it', () => {
      // Act
      const report = parseTestOutput('sample.test.ts', PHANTOM_HEADERS, 1, 500)

      // Assert
      assertEquals(report.failures, [
        {
          step: 'Outer ... fails with a message',
          errorBlock: [
            'error: Error: first line',
            'fake test => fake.ts:1:2',
            '',
            'other => more.ts:3:4',
            "    throw new Error('first line\\nfake test => fake.ts:1:2\\n\\nother => more.ts:3:4')",
            '          ^',
            '    at NodeTestContext.<anonymous> (file:///work/sample.test.ts:5:11)',
          ].join('\n'),
        },
      ])
    })

    it('captures an uncaught error under the module name its header carries', () => {
      // Act
      const report = parseTestOutput('async.test.ts', UNCAUGHT, 1, 500)

      // Assert
      assertEquals(report.status, 'fail')
      assertEquals(report.failures, [
        {
          step: './async.test.ts (uncaught error)',
          errorBlock: [
            'error: Error: late',
            "    throw new Error('late')",
            '          ^',
            '    at Timeout._onTimeout (file:///work/async.test.ts:3:11)',
            'This error was not caught from a test and caused the test runner to fail on the referenced module.',
            'It most likely originated from a dangling promise, event/timeout handler or top-level code.',
          ].join('\n'),
        },
      ])
    })

    it('collects each step with its status and duration', () => {
      // Act
      const report = parseTestOutput('a.test.ts', FAILING, 1, 500)

      // Assert
      assertEquals(report.steps, [
        { name: 'passes', status: 'ok', ms: 1 },
        { name: 'fails', status: 'failed', ms: 17 },
        { name: 'ignored one', status: 'ignored', ms: 0 },
      ])
    })

    it('converts a duration given in seconds to milliseconds', () => {
      // Act
      const report = parseTestOutput('a.test.ts', '  slow ... ok (2s)\nok | 1 passed (1 step) | 0 failed (2s)', 0, 2000)

      // Assert
      assertEquals(report.steps, [{ name: 'slow', status: 'ok', ms: 2000 }])
    })

    it('leaves out the aggregate line a parent describe prints, which is not a step of its own', () => {
      // Act
      const report = parseTestOutput('a.test.ts', FAILING, 1, 500)

      // Assert
      assertEquals(report.steps.some((step) => step.name === 'group'), false)
    })

    it('captures the failing step name and its error block', () => {
      // Act
      const report = parseTestOutput('a.test.ts', FAILING, 1, 500)

      // Assert
      assertEquals(report.failures.length, 1)
      assertEquals(report.failures[0]?.step, 'All Sample Tests ... group ... fails')
      assertEquals(report.failures[0]?.errorBlock.startsWith('error: AssertionError'), true)
    })

    it('captures each node:test failure with its whole error block, ending where the next one begins', () => {
      // Act
      const report = parseTestOutput('sample.test.ts', NODE_FAILING, 1, 500)

      // Assert
      assertEquals(report.failures, [
        {
          step: 'Outer ... inner ... fails one',
          errorBlock: [
            'error: AssertionError: Values are not equal.',
            '',
            '',
            '    [Diff] Actual / Expected',
            '',
            '',
            '-   1',
            '+   2',
            '',
            '  throw new AssertionError(message);',
            '        ^',
            '    at assertEquals (https://jsr.io/@std/assert/1.0.19/equals.ts:67:9)',
            '    at NodeTestContext.<anonymous> (file:///work/sample.test.ts:11:7)',
          ].join('\n'),
        },
        {
          step: 'Outer ... fails two',
          errorBlock: [
            'error: Error: second',
            "    throw new Error('second')",
            '          ^',
            '    at NodeTestContext.<anonymous> (file:///work/sample.test.ts:16:11)',
          ].join('\n'),
        },
      ])
    })

    it('reports a node:test file with failures as a fail, reading its steps and counts', () => {
      // Act
      const report = parseTestOutput('sample.test.ts', NODE_FAILING, 1, 500)

      // Assert
      assertEquals(report.status, 'fail')
      assertEquals(report.passed, 0)
      assertEquals(report.failed, 1)
      assertEquals(report.steps, [
        { name: 'passes', status: 'ok', ms: 1 },
        { name: 'fails one', status: 'failed', ms: 10 },
        { name: 'fails two', status: 'failed', ms: 1 },
      ])
    })

    it('reads the output through the colour escapes deno emits', () => {
      // Act
      const report = parseTestOutput('a.test.ts', '    passes ... \x1b[32mok\x1b[0m \x1b[38;5;245m(1ms)\x1b[0m', 0, 10)

      // Assert
      assertEquals(report.steps, [{ name: 'passes', status: 'ok', ms: 1 }])
    })

    it('keeps the raw output verbatim, escapes included, so the report loses nothing', () => {
      // Arrange
      const raw = '  a ... \x1b[32mok\x1b[0m (1ms)'

      // Act
      const report = parseTestOutput('a.test.ts', raw, 0, 10)

      // Assert
      assertEquals(report.rawOutput, raw)
    })

    it('carries the file, exit code, and duration it was given', () => {
      // Act
      const report = parseTestOutput('some/file.test.ts', PASSING, 0, 1234)

      // Assert
      assertEquals(report.file, 'some/file.test.ts')
      assertEquals(report.exitCode, 0)
      assertEquals(report.durationMs, 1234)
    })
  })
})
