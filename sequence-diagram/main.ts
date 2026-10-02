import { parseArgs } from '@std/cli/parse-args'
import { resolve } from '@std/path'
import { handleCliError, unwrap } from '../utils/cli.utils.ts'
import { callerDirectory } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safe } from '../utils/safe.utils.ts'
import { render } from './render.ts'
import { parseDiagram } from './schema.ts'

const KNOWN_FLAGS = new Set(['help', 'h'])

// Positionals stay strings, so a file named `007` is not read back as `7`.
const args = parseArgs(Deno.args, {
  string: ['_'],
  boolean: ['help'],
  alias: { h: 'help' },
})

const printHelp = (): void => {
  const lines = [
    'Usage: sequence-diagram <file.json>',
    '',
    'Renders a JSON sequence diagram as an ASCII layout and prints it to stdout for pasting into a fenced block.',
    '',
    'JSON shape:',
    '  { "participants": ["A", "B"], "rows": [ ... ] }',
    '',
    'Row kinds:',
    '  { "from": "A", "to": "B", "label": "text", "note"?: "text", "annotation"?: "text", "style"?: "double" }',
    '  { "from": "A", "label": "text", "target": "text" }   message to something outside the diagram',
    '  { "at": "A", "text": "text", "annotation"?: "text" } self stub on one lifeline',
    '  { "at": "A", "annotation": "text" }                  indented line under one lifeline',
    '',
    'A relative file path resolves from the directory deno task was called from.',
    '',
    'Options:',
    '  --help, -h    Show this help',
  ]

  console.log(lines.join('\n'))
}

const unknownKeys = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.has(key))
const unknownFlags = unknownKeys.map((key) => (key.length === 1 ? `-${key}` : `--${key}`))
if (unknownFlags.length) handleCliError(new CliError(`Unknown flag: ${unknownFlags.join(', ')}`, ['Run with --help for usage']))

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const run = (): string => {
  const [file, ...rest] = args._.map(String)
  if (!file) throw new CliError('Missing diagram file', ['Usage: sequence-diagram <file.json>', 'Run with --help for the JSON shape'])

  const unexpected = rest.map((arg) => `"${arg}"`).join(', ')
  if (rest.length) throw new CliError(`Unexpected argument: ${unexpected}`, ['Pass one diagram file per run'])

  const path = resolve(callerDirectory(), file)
  const { data: raw, error: readError } = safe(() => Deno.readTextFileSync(path))
  if (readError) throw new CliError(`Cannot read "${path}"`, [readError.message])

  const { data: json, error: parseError } = safe((): unknown => JSON.parse(raw))
  if (parseError) throw new CliError(`"${path}" is not valid JSON`, [parseError.message])

  return render(parseDiagram(json))
}

Deno.stdout.writeSync(new TextEncoder().encode(unwrap(safe(() => run()))))

Deno.exit(0)
