import { parseArgs } from '@std/cli/parse-args'
import { fromFileUrl, resolve } from '@std/path'
import { handleCliError } from '../utils/cli.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { toInvocation } from '../utils/parse.utils.ts'
import { safeAsync } from '../utils/safe.utils.ts'
import { runCompare } from './commands/compare.ts'
import { runRedundant } from './commands/redundant.ts'
import { runUpdate } from './commands/update.ts'
import { LANGUAGES, selectLanguages } from './languages.ts'
import { readThemeFile } from './sources.ts'

const COMMANDS = ['compare', 'update', 'redundant'] as const
const KNOWN_FLAGS = new Set(['help', 'h', 'theme', 'zed', 'pinned', 'json'])

// The theme this tool maintains.
const DEFAULT_THEME = fromFileUrl(new URL('./one-dark.theme.ts', import.meta.url))

const args = parseArgs(Deno.args, {
  string: ['theme', 'zed', 'pinned'],
  boolean: ['help', 'json'],
  alias: { h: 'help' },
  default: { theme: DEFAULT_THEME },
})

const printHelp = (): void => {
  const lines = [
    'Usage: shiki-zed-parity [compare [<language>]] --zed <path> [--theme <path>] [--json]',
    '       shiki-zed-parity update --zed <path> --pinned <path> [--theme <path>]',
    '       shiki-zed-parity redundant [--theme <path>]',
    '',
    "Compares a Shiki theme against Zed's One Dark by coloring a sample per language two ways:",
    "with a Zed checkout's highlights.scm through tree-sitter, and with Shiki and the theme, then diffing per character.",
    '',
    'Commands:',
    '  compare [<language>]      List every fragment the two color differently (the default)',
    '  update                    Report what changed between a checkout at the commit the theme links and a current one',
    '  redundant                 List selectors whose removal alone changes no sample character, as candidates',
    '',
    'Options:',
    '  --theme <path>            A module exporting the Shiki theme as zedOneDark (default: shiki-zed-parity/one-dark.theme.ts)',
    '  --zed <path>              A zed-industries/zed checkout, read as it stands on disk (compare and update)',
    '  --pinned <path>           update: a zed-industries/zed checkout at the commit the theme links',
    '  --json                    compare: print one json record per line with the full scope stack',
    '  --help, -h                Show this help',
    '',
    `Languages: ${LANGUAGES.map((language) => language.name).join(', ')}`,
  ]

  console.log(lines.join('\n'))
}

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const run = async (): Promise<void> => {
  const unknownFlags = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.has(key))
  const { command, argument } = toInvocation({ positionals: args._.map(String), commands: COMMANDS, withArgument: ['compare'], fallback: 'compare', unknownFlags })
  const languages = selectLanguages(argument)

  const checkout = args.zed ? resolve(args.zed) : ''
  const pinned = args.pinned ? resolve(args.pinned) : ''

  if (command !== 'compare' && args.json) throw new CliError(`The ${command} command takes no --json`, ['Only compare prints records'])
  if (command === 'redundant' && args.zed !== undefined) throw new CliError('The redundant command takes no --zed', ['redundant reads no Zed checkout'])
  if (command !== 'update' && args.pinned !== undefined) throw new CliError(`The ${command} command takes no --pinned`, ['Only update reads two checkouts'])
  if (command !== 'redundant' && !checkout) throw new CliError(`The ${command} command needs --zed <path>`, ['Pass the path of a zed-industries/zed checkout'])
  if (command === 'update' && !pinned) throw new CliError('The update command needs --pinned <path>', ['Pass a checkout at the commit the theme links'])
  if (!args.theme) throw new CliError('--theme takes a path', ['Omit it to check shiki-zed-parity/one-dark.theme.ts'])

  const { theme, source } = await readThemeFile(resolve(args.theme))
  if (command === 'redundant') return await runRedundant(theme)
  if (command === 'compare') return await runCompare({ checkout, theme, languages }, args.json)

  await runUpdate({ checkout, pinned, theme, source })
}

const { error } = await safeAsync(() => run())
if (error) handleCliError(error)

Deno.exit(0)
