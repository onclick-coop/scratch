import { parseArgs } from '@std/cli/parse-args'
import { handleCliError } from '../utils/cli.utils.ts'
import { callerDirectory, readConfigText } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { parseCount, toInvocation } from '../utils/parse.utils.ts'
import { safeAsync } from '../utils/safe.utils.ts'
import { parseConfig, resolveSession } from './config.ts'
import { capturePane, createWindow, killWindow, listPanes, sendKeys, sessionExists, splitPane } from './io.ts'
import { assertOwned, isOwned, toWindowName } from './own.ts'
import { resolvePane } from './parse.ts'

const DEFAULT_LINES = 200
const COMMANDS: readonly string[] = ['read', 'list', 'new', 'split', 'send', 'kill']
const WITH_ARGUMENT: readonly string[] = ['new', 'send']
const KNOWN_FLAGS = new Set(['help', 'h', 'session', 's', 'window', 'w', 'lines', 'n'])

// `--` collects text the parser would read as flags, so a line starting with a dash can be sent.
const args = parseArgs(Deno.args, {
  '--': true,
  string: ['session', 'window', 'lines'],
  boolean: ['help'],
  alias: { h: 'help', s: 'session', w: 'window', n: 'lines' },
})

const printHelp = (): void => {
  const lines = [
    'Usage: tmux <command> [argument] [--window <target>] [--session <name>] [--lines <n>]',
    '',
    'Prints a tmux pane from a session, and manages the windows it creates.',
    '',
    'Commands:',
    '  read                   Print the target pane (the default when no command is given)',
    "  list                   List the session's windows and panes",
    '  new <name>             Create a window named claude-<name> and print its name',
    '  split                  Split the target pane inside an owned window',
    '  send <text>            Type the text into the target pane and press Enter',
    '  kill                   Kill the target window',
    '',
    'split, send, and kill refuse any window this tool did not create.',
    '',
    'Options:',
    '  --window,  -w <target> Window index or name, optionally `window.pane` (default: the active pane)',
    '  --session, -s <name>   Session to reach (default: the tmux session in tools.config.json)',
    '  --lines,   -n <n>      Scrollback lines to capture (default: 200)',
    '  --help,    -h          Show this help',
  ]

  console.log(lines.join('\n'))
}

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const run = async (): Promise<void> => {
  const positionals = args._.map(String)
  const escaped = args['--'].join(' ')
  const unknownFlags = Object.keys(args).filter((key) => key !== '_' && key !== '--' && !KNOWN_FLAGS.has(key))
  const { command, argument } = toInvocation({
    positionals: escaped ? [...positionals, escaped] : positionals,
    commands: COMMANDS,
    withArgument: WITH_ARGUMENT,
    fallback: 'read',
    unknownFlags,
  })

  if (args.lines !== undefined && command !== 'read') {
    throw new CliError(`The ${command} command takes no --lines`, [
      '--lines sets how much of a pane prints, so it applies to read alone',
    ])
  }

  const { name: session, startHint } = resolveSession(args.session, parseConfig(await readConfigText(callerDirectory())))
  const exists = await sessionExists(session)
  if (!exists) throw new CliError(`No tmux session "${session}"`, [startHint])

  const panes = await listPanes(session)

  if (command === 'list') {
    for (const pane of panes) {
      const marker = pane.active ? '*' : ' '
      const owned = isOwned(pane) ? ' [owned]' : ''
      console.log(`${marker} ${pane.window}.${pane.pane}\t${pane.windowName}\t(${pane.command})${owned}`)
    }

    return
  }

  if (command === 'new') {
    const name = toWindowName(argument ?? '')
    const isTaken = panes.some((entry) => entry.windowName === name)
    if (isTaken) throw new CliError(`Window "${name}" already exists`, ['Read it with --window, or kill it first'])

    // A new window would otherwise open in the tmux client's directory rather than the caller's.
    await createWindow(session, name, callerDirectory())
    console.log(name)

    return
  }

  const pane = resolvePane(session, args.window, panes)

  if (command === 'kill') {
    assertOwned(pane, 'kill')
    await killWindow(pane)

    return
  }

  if (command === 'split') {
    assertOwned(pane, 'split')
    await splitPane(pane)

    return
  }

  if (command === 'send') {
    if (argument === undefined) throw new CliError('No text to send', ['Pass the text after the command, as `send "echo hi"`'])

    assertOwned(pane, 'send keys to')
    await sendKeys(pane, argument)

    return
  }

  const output = await capturePane(pane, parseCount(args.lines, DEFAULT_LINES, '--lines'))

  // An empty capture looks unreadable, so the notice goes to stderr and the pipe stays clean.
  if (!output.trim()) {
    console.error(`Pane ${pane.window}.${pane.pane} (${pane.command}) has no content to capture`)
    return
  }

  console.log(output)
}

const { error } = await safeAsync(() => run())
if (error) handleCliError(error)

Deno.exit(0)
