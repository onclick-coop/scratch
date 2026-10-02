import { parseArgs } from '@std/cli/parse-args'
import { expandGlob } from '@std/fs'
import { dirname, relative, resolve } from '@std/path'
import { handleCliError } from '../utils/cli.utils.ts'
import { callerDirectory, readConfigText } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safeAsync } from '../utils/safe.utils.ts'
import { parseConfig, resolveSettings, type Settings } from './config.ts'
import { renderMarkdown } from './markdown.ts'
import { parseTestOutput } from './parse.ts'
import type { RunState } from './schema.ts'
import { newState, parseState, toRows } from './state.ts'

const COMMANDS: readonly string[] = ['run', 'failed', 'continue', 'show', 'list']
const KNOWN_FLAGS = new Set(['help', 'h'])

const printHelp = (): void => {
  const lines = [
    'Usage: test-report <command> [options] [files...]',
    '',
    'Runs deno test for one file at a time, captures full output, and writes a structured report.',
    '',
    'Commands:',
    '  run [files...]   Run every file the glob matches, or only the listed files. Resets prior state.',
    '  failed           Re-run only the files that failed/crashed in the last run.',
    '  continue         Run only files that have not yet been run in the current state.',
    '  show             Print the markdown summary from the current state.',
    '  list             List the file paths in the current state, with status.',
    '',
    'Options:',
    '  --help, -h       Show this help',
    '',
    'Settings come from the test-report section of the tools.config.json in the directory deno task was called from.',
    'The report and state default to /tmp/<name>-<hash>-test-report.md and .json, named for that directory and its path.',
  ]
  console.log(lines.join('\n'))
}

const args = parseArgs(Deno.args, {
  boolean: ['help'],
  alias: { h: 'help' },
  '--': false,
  stopEarly: false,
})

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const readState = async (settings: Settings): Promise<RunState> => {
  const { data: text, error } = await safeAsync(() => Deno.readTextFile(settings.statePath))
  if (error) throw new CliError('No prior state.', [`Looked for ${settings.statePath}`, 'Start one with the run command'])

  return parseState(text, settings.statePath)
}

const saveState = async (settings: Settings, state: RunState): Promise<void> => {
  const tmp = `${settings.statePath}.tmp`
  await Deno.writeTextFile(tmp, JSON.stringify(state, null, 2))
  await Deno.rename(tmp, settings.statePath)
}

const isDirectory = async (path: string): Promise<boolean> => {
  const { data: info, error } = await safeAsync(() => Deno.stat(path))

  return !error && info.isDirectory
}

const collectAllTestFiles = async (settings: Settings): Promise<string[]> => {
  const collected: string[] = []

  for await (const entry of expandGlob(settings.glob, { root: settings.directory, includeDirs: false, exclude: ['**/node_modules'] })) {
    if (entry.isFile) collected.push(relative(settings.directory, entry.path))
  }

  collected.sort()
  return collected
}

const runOneFile = async (settings: Settings, file: string): Promise<{ output: string; exitCode: number; durationMs: number }> => {
  const start = performance.now()
  const cmd = new Deno.Command('deno', {
    args: [...settings.args, file],
    cwd: settings.directory,
    stdout: 'piped',
    stderr: 'piped',
  })
  const { code, stdout, stderr } = await cmd.output()
  const durationMs = Math.round(performance.now() - start)
  const decoder = new TextDecoder()
  const output = decoder.decode(stdout) + decoder.decode(stderr)
  return { output, exitCode: code, durationMs }
}

const runFiles = async (settings: Settings, state: RunState, files: string[]): Promise<RunState> => {
  let next = state
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    console.error(`[${i + 1}/${files.length}] ${file}`)
    const { output, exitCode, durationMs } = await runOneFile(settings, file)
    const report = parseTestOutput(file, output, exitCode, durationMs)

    next = {
      ...next,
      reports: { ...next.reports, [file]: report },
    }

    const tag = report.status === 'pass' ? 'pass' : report.status === 'fail' ? 'FAIL' : 'CRASH'
    console.error(`  -> ${tag} (${report.passed} ok, ${report.failed} failed, exit ${report.exitCode})`)

    await saveState(settings, next)
    await Deno.writeTextFile(settings.reportPath, renderMarkdown(next))
  }
  return next
}

const cmdRun = async (settings: Settings, filesArg: string[]): Promise<void> => {
  const files = filesArg.length > 0 ? filesArg : await collectAllTestFiles(settings)
  if (files.length === 0) {
    throw new CliError('No test files found.', [`Looked for ${settings.glob} under ${settings.directory}`])
  }

  const missing: string[] = []
  for (const file of filesArg) {
    const { error: statError } = await safeAsync(() => Deno.stat(resolve(settings.directory, file)))
    if (statError) missing.push(file)
  }

  if (missing.length > 0) {
    throw new CliError(`No such test file under ${settings.directory}: ${missing.join(', ')}`, [
      'Pass paths relative to the directory in tools.config.json, or pass none to run every file the glob matches',
    ])
  }

  const initial = newState(files)
  await saveState(settings, initial)
  const finalState = await runFiles(settings, initial, files)
  await Deno.writeTextFile(settings.reportPath, renderMarkdown(finalState))
  console.error(`\nReport: ${settings.reportPath}`)
  console.error(`State:  ${settings.statePath}`)
}

const cmdFailed = async (settings: Settings): Promise<void> => {
  const state = await readState(settings)

  const failedFiles = state.files.filter((f) => {
    const report = state.reports[f]
    return report !== undefined && report.status !== 'pass'
  })

  if (failedFiles.length === 0) {
    console.error('No failed files in the current state.')
    return
  }

  console.error(`Re-running ${failedFiles.length} failed/crashed files.`)
  const finalState = await runFiles(settings, state, failedFiles)
  await Deno.writeTextFile(settings.reportPath, renderMarkdown(finalState))
  console.error(`\nReport: ${settings.reportPath}`)
}

const cmdContinue = async (settings: Settings): Promise<void> => {
  const state = await readState(settings)

  const pending = state.files.filter((f) => state.reports[f] === undefined)
  if (pending.length === 0) {
    console.error('All files in the current state have been run.')
    return
  }

  console.error(`Continuing with ${pending.length} pending files.`)
  const finalState = await runFiles(settings, state, pending)
  await Deno.writeTextFile(settings.reportPath, renderMarkdown(finalState))
  console.error(`\nReport: ${settings.reportPath}`)
}

const cmdShow = async (settings: Settings): Promise<void> => {
  const state = await readState(settings)
  console.log(renderMarkdown(state))
}

const cmdList = async (settings: Settings): Promise<void> => {
  const state = await readState(settings)
  console.table(toRows(state))
}

const run = async (): Promise<void> => {
  const [unknown] = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.has(key))
  if (unknown) throw new CliError(`Unknown option: "--${unknown}"`, [`Commands are words, not flags: ${COMMANDS.join(', ')}`, 'Run with --help for usage'])

  const [command, ...rest] = args._.map(String)
  if (!command) throw new CliError('No command given', [`Valid commands: ${COMMANDS.join(', ')}`, 'Run with --help for usage'])

  if (!COMMANDS.includes(command)) {
    throw new CliError(`Unknown command: "${command}"`, [`Valid commands: ${COMMANDS.join(', ')}`, 'Run with --help for usage'])
  }

  const [extra] = rest
  if (extra !== undefined && command !== 'run') throw new CliError(`The ${command} command takes no files`, ['Pass files to the run command alone'])

  const root = callerDirectory()
  const settings = await resolveSettings(parseConfig(await readConfigText(root)), root)

  // Checked before anything writes, so a wrong path leaves the last run's state intact.
  const isRunning = command === 'run' || command === 'failed' || command === 'continue'
  if (isRunning) {
    const hasDirectory = await isDirectory(settings.directory)
    if (!hasDirectory) {
      throw new CliError(`No directory at ${settings.directory}`, [
        'Point directory in the test-report section of tools.config.json at the directory the tests run from',
      ])
    }

    const reportParent = dirname(settings.reportPath)
    const hasReportParent = await isDirectory(reportParent)
    if (!hasReportParent) {
      throw new CliError(`No directory at ${reportParent} to write the report in`, [
        'Create it, or point report in the test-report section of tools.config.json at a file in an existing directory',
      ])
    }

    const stateParent = dirname(settings.statePath)
    const hasStateParent = await isDirectory(stateParent)
    if (!hasStateParent) {
      throw new CliError(`No directory at ${stateParent} to write the state in`, [
        'Create it, or point state in the test-report section of tools.config.json at a file in an existing directory',
      ])
    }
  }

  switch (command) {
    case 'run':
      await cmdRun(settings, rest)
      break
    case 'failed':
      await cmdFailed(settings)
      break
    case 'continue':
      await cmdContinue(settings)
      break
    case 'show':
      await cmdShow(settings)
      break
    case 'list':
      await cmdList(settings)
      break
  }
}

const { error } = await safeAsync(() => run())
if (error) handleCliError(error)

Deno.exit(0)
