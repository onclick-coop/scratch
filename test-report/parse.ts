import { stripAnsi } from '../utils/ansi.utils.ts'
import type { FailureDetail, FileReport, StepResult } from './schema.ts'

// Matches one step line, capturing its indent, name, status, and duration with its unit.
export const stepPattern = /^(\s*)(\S.*?) \.\.\. (ok|FAILED|ignored)(?: \((\d+)(ms|s)\))?\s*$/

// Matches the ERRORS banner, which deno prints padded on its own line.
export const errorsHeaderPattern = /^\s*ERRORS\s*$/

// Matches the FAILURES banner, which deno prints padded on its own line.
export const failuresHeaderPattern = /^\s*FAILURES\s*$/

// Matches an error header naming a test, capturing the name before the arrow to the test's location.
export const errorHeaderPattern = /^(\S.*?) => \S+:\d+:\d+\s*$/

// Matches the final summary, capturing the passed and failed counts; deno writes `step` singular for one.
export const summaryPattern = /^(ok|FAILED) \| (\d+) passed(?: \(\d+ steps?\))? \| (\d+) failed(?: \(\d+ steps?\))?(?: \| .*)?\s*\((?:\d+ms|\d+s|\d+m\d+s)\)\s*$/

const toMs = (n: number, unit: string): number => unit === 's' ? n * 1000 : n

export const parseTestOutput = (file: string, rawOutput: string, exitCode: number, durationMs: number): FileReport => {
  const stripped = stripAnsi(rawOutput)
  const lines = stripped.split('\n')

  // Deno lists each real error header again under FAILURES, which a message line shaped like one never is.
  const listedHeaders = new Set<string>()
  let inFailures = false
  for (const line of lines) {
    if (failuresHeaderPattern.test(line)) {
      inFailures = true
      continue
    }

    if (summaryPattern.test(line)) break
    if (inFailures && line.trim()) listedHeaders.add(line.trimEnd())
  }

  const steps: StepResult[] = []
  const failures: FailureDetail[] = []
  let passed = 0
  let failed = 0
  let inErrors = false
  let currentErrorStep: string | null = null
  let currentErrorBuffer: string[] = []

  const flushErrorBlock = (): void => {
    if (currentErrorStep === null) return
    failures.push({
      step: currentErrorStep,
      errorBlock: currentErrorBuffer.join('\n').trim(),
    })
    currentErrorStep = null
    currentErrorBuffer = []
  }

  for (const line of lines) {
    if (errorsHeaderPattern.test(line)) {
      inErrors = true
      continue
    }

    if (failuresHeaderPattern.test(line)) {
      flushErrorBlock()
      inErrors = false
      continue
    }

    if (inErrors) {
      if (listedHeaders.has(line.trimEnd())) {
        flushErrorBlock()

        // An uncaught error's header names the module with no arrow, so the whole line is its name.
        const headerMatch = errorHeaderPattern.exec(line)
        currentErrorStep = headerMatch ? headerMatch[1] : line.trim()
        continue
      }

      currentErrorBuffer.push(line)
      continue
    }

    const stepMatch = stepPattern.exec(line)
    if (stepMatch) {
      const [, , name, status, msStr, unit] = stepMatch
      if (msStr === undefined) continue
      const normalized: StepResult['status'] = status === 'ok' ? 'ok' : status === 'ignored' ? 'ignored' : 'failed'
      const ms = toMs(parseInt(msStr, 10), unit ?? 'ms')
      steps.push({ name: name.trim(), status: normalized, ms })
      continue
    }

    const summaryMatch = summaryPattern.exec(line)
    if (summaryMatch) {
      passed = parseInt(summaryMatch[2], 10)
      failed = parseInt(summaryMatch[3], 10)
    }
  }

  flushErrorBlock()

  let status: FileReport['status']
  if (exitCode === 0) {
    status = 'pass'
  } else if (failed > 0 || failures.length > 0) {
    status = 'fail'
  } else {
    status = 'crash'
  }

  return {
    file,
    exitCode,
    durationMs,
    status,
    passed,
    failed,
    steps,
    failures,
    rawOutput,
  }
}
