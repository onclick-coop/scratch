import { resolve } from '@std/path'
import { handleCliError } from '../utils/cli.utils.ts'
import { callerDirectory, readConfigText } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safeAsync } from '../utils/safe.utils.ts'
import { runAdd } from './commands/add.ts'
import { runCheck } from './commands/check.ts'
import { runEdit } from './commands/edit.ts'
import { runList } from './commands/list.ts'
import { runRemove } from './commands/remove.ts'
import { runUncheck } from './commands/uncheck.ts'
import { parseCommandLine } from './args.ts'
import { parseConfig } from './config.ts'
import { runOnFile } from './file.ts'
import { load, save } from './io.ts'
import type { Command } from './schema.ts'

const COMMANDS = new Map<string, Command>([
  ['list', runList],
  ['add', runAdd],
  ['check', runCheck],
  ['uncheck', runUncheck],
  ['remove', runRemove],
  ['edit', runEdit],
])

const printHelp = (): void => {
  const lines = [
    'Usage: todo                                  list everything',
    '       todo list [in <section>]              list one section',
    "       todo add '<text>' in <section>        add an item",
    '       todo check 0,1 in <section>           mark items done',
    '       todo uncheck 1 in <section>           mark items not done',
    '       todo remove 0,3 in <section>          delete items',
    "       todo edit 1 '<text>' in <section>     rewrite an item",
    '',
    'Manages a markdown todo list, TODO.md in the directory deno task was called from.',
    'The todo section of tools.config.json there can name another file under "file".',
    'Sections auto-resolve when only one exists.',
  ]

  console.log(lines.join('\n'))
}

const run = async (): Promise<void> => {
  const args = parseCommandLine(Deno.args)
  const valid = `Valid commands: ${[...COMMANDS.keys()].join(', ')}`

  // Checked before help, so a mistyped flag beside --help is reported rather than passed over.
  const [unknown] = args.unknownFlags
  if (unknown) {
    throw new CliError(`Unknown option: "${unknown}"`, [
      `Commands are words, not flags. ${valid}`,
      'Run with --help for usage',
    ])
  }

  if (args.help) {
    printHelp()
    return
  }

  const [verb = 'list', ...rest] = args.positionals
  const command = COMMANDS.get(verb)
  if (!command) throw new CliError(`Unknown command: "${verb}"`, [valid])

  const root = callerDirectory()
  const { file } = parseConfig(await readConfigText(root))
  const path = resolve(root, file)
  const raw = load(path)
  const outcome = runOnFile(command, rest, raw)

  if (outcome.text !== raw) save(path, outcome.text)
  console.log(outcome.output)
}

const { error } = await safeAsync(() => run())
if (error) handleCliError(error)

Deno.exit(0)
