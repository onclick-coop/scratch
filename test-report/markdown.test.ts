import { assertEquals, assertStringIncludes } from '@std/assert'
import { describe, it } from 'node:test'
import { renderMarkdown } from './markdown.ts'
import type { FileReport, RunState } from './schema.ts'

const report = (file: string, status: FileReport['status'], overrides: Partial<FileReport> = {}): FileReport => ({
  file,
  exitCode: status === 'pass' ? 0 : 1,
  durationMs: 500,
  status,
  passed: status === 'pass' ? 3 : 0,
  failed: status === 'fail' ? 1 : 0,
  steps: [],
  failures: [],
  rawOutput: 'raw output text',
  ...overrides,
})

const stateOf = (reports: FileReport[], pending: string[] = []): RunState => ({
  startedAt: '2026-09-13T00:00:00.000Z',
  files: [...reports.map((entry) => entry.file), ...pending],
  reports: Object.fromEntries(reports.map((entry) => [entry.file, entry])),
})

describe('All Test Report Markdown Tests', () => {
  describe('renderMarkdown', () => {
    it('counts the files by status in the header', () => {
      // Arrange
      const state = stateOf([report('a.ts', 'pass'), report('b.ts', 'fail'), report('c.ts', 'crash')])

      // Act
      const markdown = renderMarkdown(state)

      // Assert
      assertStringIncludes(markdown, '- files: 1 pass, 1 fail, 1 crash')
    })

    it('counts a file that has not run as pending rather than as a result', () => {
      // Arrange
      const state = stateOf([report('a.ts', 'pass')], ['b.ts'])

      // Act
      const markdown = renderMarkdown(state)

      // Assert
      assertStringIncludes(markdown, '- files: 2 total, 1 run, 1 pending')
      assertStringIncludes(markdown, '## Pending files')
    })

    it('puts crashed files ahead of failed ones, since a crash explains the run', () => {
      // Arrange
      const state = stateOf([report('a.ts', 'fail'), report('b.ts', 'crash')])

      // Act
      const markdown = renderMarkdown(state)

      // Assert
      assertEquals(markdown.indexOf('## Crashed files') < markdown.indexOf('## Failed files'), true)
    })

    it('includes the whole raw output of a failing file, so the report loses nothing', () => {
      // Arrange
      const state = stateOf([report('a.ts', 'fail', { rawOutput: 'line one\nline two' })])

      // Act
      const markdown = renderMarkdown(state)

      // Assert
      assertStringIncludes(markdown, 'line one\nline two')
    })

    it('gives a passing file one line rather than its output', () => {
      // Arrange
      const state = stateOf([report('a.ts', 'pass', { rawOutput: 'noise nobody needs' })])

      // Act
      const markdown = renderMarkdown(state)

      // Assert
      assertStringIncludes(markdown, '- a.ts (3 passed, 500ms)')
      assertEquals(markdown.includes('noise nobody needs'), false)
    })

    it('renders each failed step with its error block', () => {
      // Arrange
      const failures = [{ step: 'suite ... case', errorBlock: 'AssertionError: nope' }]
      const state = stateOf([report('a.ts', 'fail', { failures })])

      // Act
      const markdown = renderMarkdown(state)

      // Assert
      assertStringIncludes(markdown, '#### suite ... case')
      assertStringIncludes(markdown, 'AssertionError: nope')
    })

    it('prints a duration under a second in milliseconds and above it in seconds', () => {
      // Arrange
      const state = stateOf([report('a.ts', 'pass', { durationMs: 999 }), report('b.ts', 'pass', { durationMs: 1500 })])

      // Act
      const markdown = renderMarkdown(state)

      // Assert
      assertStringIncludes(markdown, '999ms)')
      assertStringIncludes(markdown, '1.5s)')
    })

    it('omits a section when no file falls into it', () => {
      // Arrange
      const state = stateOf([report('a.ts', 'pass')])

      // Act
      const markdown = renderMarkdown(state)

      // Assert
      assertEquals(markdown.includes('## Failed files'), false)
      assertEquals(markdown.includes('## Crashed files'), false)
      assertEquals(markdown.includes('## Pending files'), false)
    })

    it('totals the steps across every file that ran', () => {
      // Arrange
      const state = stateOf([report('a.ts', 'pass', { passed: 5 }), report('b.ts', 'fail', { passed: 2, failed: 3 })])

      // Act
      const markdown = renderMarkdown(state)

      // Assert
      assertStringIncludes(markdown, '- steps: 7/10 passed')
    })
  })
})
