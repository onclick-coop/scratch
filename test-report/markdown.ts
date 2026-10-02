import type { FileReport, RunState } from './schema.ts'

const fmtDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const renderFailureDetail = (report: FileReport): string => {
  const lines: string[] = []
  lines.push(`### ${report.file}`)
  lines.push('')
  lines.push(`- exitCode: ${report.exitCode}`)
  lines.push(`- duration: ${fmtDuration(report.durationMs)}`)
  lines.push(`- status: ${report.status}`)
  lines.push(`- passed: ${report.passed}, failed: ${report.failed}`)
  lines.push('')

  if (report.failures.length > 0) {
    lines.push('**Failed steps:**')
    lines.push('')
    for (const failure of report.failures) {
      lines.push(`#### ${failure.step}`)
      lines.push('')
      lines.push('```')
      lines.push(failure.errorBlock)
      lines.push('```')
      lines.push('')
    }
  }

  lines.push('**Full output:**')
  lines.push('')
  lines.push('```')
  lines.push(report.rawOutput.trimEnd())
  lines.push('```')
  lines.push('')

  return lines.join('\n')
}

const renderPassLine = (report: FileReport): string => {
  return `- ${report.file} (${report.passed} passed, ${fmtDuration(report.durationMs)})`
}

export const renderMarkdown = (state: RunState): string => {
  const reports = state.files.map((file) => state.reports[file]).filter((r): r is FileReport => r !== undefined)
  const passes = reports.filter((r) => r.status === 'pass')
  const fails = reports.filter((r) => r.status === 'fail')
  const crashes = reports.filter((r) => r.status === 'crash')
  const pending = state.files.filter((f) => state.reports[f] === undefined)

  const totalSteps = reports.reduce((sum, r) => sum + r.passed + r.failed, 0)
  const totalFailedSteps = reports.reduce((sum, r) => sum + r.failed, 0)
  const totalDuration = reports.reduce((sum, r) => sum + r.durationMs, 0)

  const lines: string[] = []
  lines.push('# Test report')
  lines.push('')
  lines.push(`- started: ${state.startedAt}`)
  lines.push(`- files: ${state.files.length} total, ${reports.length} run, ${pending.length} pending`)
  lines.push(`- files: ${passes.length} pass, ${fails.length} fail, ${crashes.length} crash`)
  lines.push(`- steps: ${totalSteps - totalFailedSteps}/${totalSteps} passed`)
  lines.push(`- total runtime: ${fmtDuration(totalDuration)}`)
  lines.push('')

  if (crashes.length > 0) {
    lines.push('## Crashed files')
    lines.push('')
    lines.push('Files that exited non-zero without producing a normal failure summary (compile errors, panics, port races).')
    lines.push('')
    for (const report of crashes) {
      lines.push(renderFailureDetail(report))
    }
  }

  if (fails.length > 0) {
    lines.push('## Failed files')
    lines.push('')
    for (const report of fails) {
      lines.push(renderFailureDetail(report))
    }
  }

  if (pending.length > 0) {
    lines.push('## Pending files')
    lines.push('')
    lines.push('Files that have not been run yet in this report.')
    lines.push('')
    for (const file of pending) {
      lines.push(`- ${file}`)
    }
    lines.push('')
  }

  if (passes.length > 0) {
    lines.push('## Passed files')
    lines.push('')
    for (const report of passes) {
      lines.push(renderPassLine(report))
    }
    lines.push('')
  }

  return lines.join('\n')
}
