import { parseArgs } from '@std/cli/parse-args'
import { resolve } from '@std/path'
import { TextLineStream } from '@std/streams'
import { handleCliError } from '../utils/cli.utils.ts'
import { callerDirectory, readConfigText } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safe, safeAsync } from '../utils/safe.utils.ts'
import { parseConfig, resolveLogPath, suggestMissing } from './config.ts'
import { assertArgs, type Filter, isLevel, matches } from './parse.ts'

const args = parseArgs(Deno.args, {
  string: ['level', 'cat', 'file', 'service'],
  boolean: ['help', 'no-follow'],
  alias: { h: 'help', l: 'level', c: 'cat', f: 'file', s: 'service' },
})

const printHelp = (): void => {
  const lines = [
    'Usage: log [--service <name>] [--level <level>] [--cat <substring>] [--no-follow] [--file <path>]',
    '',
    'Tails a log file with optional level and category filters.',
    '',
    'Options:',
    "  --service, -s <name>   Which service's log to read (default: the defaultService in tools.config.json)",
    '  --level,   -l <level>  Show only this level and above (trace, debug, info, warn, error, fatal)',
    '  --cat,     -c <substr> Show only lines whose category contains substr (e.g. "http" or "middleware")',
    '  --no-follow            Print existing lines and exit instead of tailing',
    '  --file,    -f <path>   Read this file instead of a service log, resolved from the calling directory',
    '  --help,    -h          Show this help',
    '',
    'Services come from the log section of the tools.config.json in the directory deno task was called from.',
    'Lines without a recognizable logtape header (stack traces, raw watcher output) pass through unfiltered.',
  ]

  console.log(lines.join('\n'))
}

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const run = async (): Promise<void> => {
  assertArgs({ positionals: args._.map(String), keys: Object.keys(args), level: args.level, cat: args.cat })

  const root = callerDirectory()
  const config = parseConfig(await readConfigText(root))
  const path = resolve(root, resolveLogPath({ service: args.service, file: args.file, config }))

  const { error: statError } = await safeAsync(() => Deno.stat(path))
  if (statError) throw new CliError(`Log file not found: ${path}`, [suggestMissing(args.file), 'Or pass --file <path>'])

  const filter: Filter = {
    minLevel: args.level !== undefined && isLevel(args.level) ? args.level : null,
    category: args.cat ?? null,
  }

  // `-n +1` reads from the start, and a bare `-f` prints the last 10 lines before following.
  // `-n 0 -f` is GNU-only, so we avoid it for macOS BSD tail / busybox compatibility.
  const tailArgs = args['no-follow'] ? ['-n', '+1', path] : ['-f', path]

  const spawned = safe(() => new Deno.Command('tail', { args: tailArgs, stdout: 'piped' }).spawn())
  if (spawned.error) throw new CliError(`Failed to run tail: ${spawned.error.message}`, ['Is tail installed and on PATH?'])

  const lines = spawned.data.stdout
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream())

  for await (const line of lines) {
    if (matches(line, filter)) console.log(line)
  }

  const { data: status, error: statusError } = await safeAsync(() => spawned.data.status)
  if (statusError) throw new CliError(`tail did not complete: ${statusError.message}`)

  // A non-zero exit resolves rather than rejects, so an unreadable file would report success.
  if (!status.success) throw new CliError(`tail exited ${status.code}`, ['The file may have been removed or is unreadable'])
}

const { error } = await safeAsync(() => run())
if (error) handleCliError(error)

Deno.exit(0)
