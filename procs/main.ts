import { parseArgs } from '@std/cli/parse-args'
import { resolve } from '@std/path'
import { handleCliError } from '../utils/cli.utils.ts'
import { callerDirectory, readConfigText } from '../utils/config.utils.ts'
import { parseCount, toInvocation } from '../utils/parse.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safe, safeAsync } from '../utils/safe.utils.ts'
import { ACTIONS, buildCommand, isAction } from './action.ts'
import { parseProcNames, parseServerPort, procLogPath, tailLines } from './config.ts'
import { parseSessions, selectSession } from './sessions.ts'

const DEFAULT_LINES = 200
const COMMANDS: readonly string[] = ['logs', 'list', ...ACTIONS]
const WITH_ARGUMENT: readonly string[] = ['logs', ...ACTIONS]
const KNOWN_FLAGS = new Set(['help', 'h', 'session', 's', 'lines', 'n'])

const args = parseArgs(Deno.args, {
  string: ['session', 'lines'],
  boolean: ['help'],
  alias: { h: 'help', s: 'session', n: 'lines' },
})

const printHelp = (): void => {
  const lines = [
    'Usage: procs <command> [proc] [--session <name>] [--lines <n>]',
    '',
    'Reads and controls the procs a running gprocs session supervises.',
    '',
    'Commands:',
    "  logs <proc>            Print the proc's recent output",
    "  list                   List the session's procs",
    '  restart <proc>         Restart the proc',
    '  force-restart <proc>   Restart the proc without waiting for it to stop',
    '  start <proc>           Start the proc',
    '  stop <proc>            Stop the proc with its configured stop signal',
    '  kill <proc>            Kill the proc',
    '',
    'Options:',
    `  --lines,   -n <n>      How many trailing log lines to print (default: ${DEFAULT_LINES})`,
    '  --session, -s <name>   Which gprocs session to reach (default: the defaultSession in tools.config.json)',
    '  --help,    -h          Show this help',
    '',
    'Sessions come from the procs section of the tools.config.json in the directory deno task was called from.',
    'Reading a proc goes to the file gprocs writes for it, so it never moves which proc the pane shows.',
    'Acting on a proc names it on the command itself, so nothing can change the target between choosing and acting.',
    'A name no proc carries is refused before anything is sent.',
  ]

  console.log(lines.join('\n'))
}

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const run = async (): Promise<void> => {
  const unknownFlags = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.has(key))
  const positionals = args._.map(String)
  const { command, argument } = toInvocation({
    positionals,
    commands: COMMANDS,
    withArgument: WITH_ARGUMENT,
    fallback: 'list',
    unknownFlags,
  })

  if (args.lines !== undefined && command !== 'logs') {
    throw new CliError(`The ${command} command takes no --lines`, [
      '--lines sets how much of a log prints, so it applies to logs alone',
    ])
  }

  const lines = parseCount(args.lines, DEFAULT_LINES, '--lines')
  const root = callerDirectory()
  const { name: session, config, logDir } = selectSession(parseSessions(await readConfigText(root)), args.session)
  const configPath = resolve(root, config)

  const { data: raw, error: readError } = await safeAsync(() => Deno.readTextFile(configPath))
  if (readError) {
    const fix = `Point the ${session} session's config in tools.config.json at the mprocs config its gprocs runs`
    if (readError instanceof Deno.errors.NotFound) throw new CliError(`No mprocs config at ${configPath}`, [fix])

    throw new CliError(`Failed to read the mprocs config at ${configPath}: ${readError.message}`, [fix])
  }

  const names = parseProcNames(raw)

  if (command === 'list') {
    for (const name of names) console.log(name)

    return
  }

  if (!argument) {
    throw new CliError(`The ${command} command takes a proc name`, [`Run \`procs list\` to see the ${session} session's procs`])
  }

  // Checked here because gprocs answers nothing, so a mistyped name would pass as a restart.
  if (!names.includes(argument)) {
    throw new CliError(`No proc "${argument}" in the ${session} session`, [`Known procs: ${names.join(', ')}`])
  }

  if (command === 'logs') {
    const logPath = procLogPath({ root, session, logDir, proc: argument })

    const { data: log, error: logError } = await safeAsync(() => Deno.readTextFile(logPath))
    if (logError) throw new CliError(`No log file at ${logPath}`, [`Start the ${session} session so gprocs creates it`])

    console.log(tailLines(log, lines))

    return
  }

  if (!isAction(command)) throw new CliError(`Unknown action: "${command}"`, [`Valid actions: ${ACTIONS.join(', ')}`])

  const port = parseServerPort(raw)
  const gprocsArgs = ['--server', `127.0.0.1:${port}`, '--ctl', buildCommand(command, argument)]
  const spawned = safe(() => new Deno.Command('gprocs', { args: gprocsArgs, stdout: 'piped', stderr: 'piped' }).spawn())
  if (spawned.error) throw new CliError(`Failed to run gprocs: ${spawned.error.message}`, ['Is gprocs installed and on PATH?'])

  const { data: output, error: waitError } = await safeAsync(() => spawned.data.output())
  if (waitError) throw new CliError(`gprocs did not complete: ${waitError.message}`)

  const stderr = new TextDecoder().decode(output.stderr).trim()
  if (!output.success) {
    throw new CliError(`gprocs refused the command: ${stderr}`, [
      `Is the ${session} session running with a control server on ${port}?`,
    ])
  }

  console.error(`sent ${command} to ${argument} in ${session}`)
}

const { error } = await safeAsync(() => run())
if (error) handleCliError(error)

Deno.exit(0)
