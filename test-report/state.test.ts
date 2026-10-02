import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { newState, parseState, toRows } from './state.ts'

const REPORT = {
  file: 'a.test.ts',
  exitCode: 1,
  durationMs: 12,
  status: 'fail' as const,
  passed: 3,
  failed: 1,
  steps: [{ name: 'fails', status: 'failed' as const, ms: 4 }],
  failures: [{ step: 'suite ... fails', errorBlock: 'AssertionError' }],
  rawOutput: 'raw',
}

describe('All Test Report State Tests', () => {
  describe('parseState', () => {
    it('reads back a state the tool wrote', () => {
      // Arrange
      const text = JSON.stringify({ startedAt: '2024-01-02T03:04:05.000Z', files: ['a.test.ts', 'b.test.ts'], reports: { 'a.test.ts': REPORT } })

      // Act
      const state = parseState(text, '/tmp/project-test-report.json')

      // Assert
      assertEquals(state, { startedAt: '2024-01-02T03:04:05.000Z', files: ['a.test.ts', 'b.test.ts'], reports: { 'a.test.ts': REPORT } })
    })

    it('reads a state carrying a key it does not use, such as the directory an earlier version recorded', () => {
      // Arrange
      const text = JSON.stringify({ startedAt: '2024-01-02T03:04:05.000Z', serverDir: '/repo/server', files: [], reports: {} })

      // Act
      const state = parseState(text, '/tmp/project-test-report.json')

      // Assert
      assertEquals(state, { startedAt: '2024-01-02T03:04:05.000Z', files: [], reports: {} })
    })

    it('refuses text that is not JSON, naming the file', () => {
      // Act
      const error = assertThrows(() => parseState('{ cut short', '/tmp/project-test-report.json'), CliError, 'The state at /tmp/project-test-report.json is not valid JSON')

      // Assert
      assertEquals(error.suggestions, ['Start a new state with the run command'])
    })

    it('refuses a report whose status is none the tool writes, rather than resuming from it', () => {
      // Arrange
      const text = JSON.stringify({ startedAt: '2024-01-02T03:04:05.000Z', files: ['a.test.ts'], reports: { 'a.test.ts': { ...REPORT, status: 'skipped' } } })

      // Act & Assert
      assertThrows(() => parseState(text, '/tmp/project-test-report.json'), CliError, 'has a shape the tool cannot read')
    })

    it('refuses a state with no file list', () => {
      // Act & Assert
      assertThrows(() => parseState('{ "startedAt": "2024-01-02T03:04:05.000Z", "reports": {} }', '/tmp/s.json'), CliError, 'has a shape the tool cannot read')
    })
  })

  describe('newState', () => {
    it('carries the files it was given, in order', () => {
      // Act
      const state = newState(['b.test.ts', 'a.test.ts'])

      // Assert
      assertEquals(state.files, ['b.test.ts', 'a.test.ts'])
    })

    it('starts with no reports, since nothing has run yet', () => {
      // Act
      const state = newState(['a.test.ts'])

      // Assert
      assertEquals(state.reports, {})
    })

    it('stamps a start time to the millisecond in UTC', () => {
      // Act
      const state = newState([])

      // Assert
      assertEquals(Temporal.Instant.from(state.startedAt).toString({ smallestUnit: 'millisecond' }), state.startedAt)
    })
  })

  describe('toRows', () => {
    it('reads each file with its report status, and pending where no report exists', () => {
      // Arrange
      const state = {
        startedAt: '2024-01-02T03:04:05.000Z',
        files: ['a.test.ts', 'b.test.ts'],
        reports: { 'a.test.ts': REPORT },
      }

      // Act
      const rows = toRows(state)

      // Assert
      assertEquals(rows, [
        { status: 'fail', file: 'a.test.ts' },
        { status: 'pending', file: 'b.test.ts' },
      ])
    })
  })
})
