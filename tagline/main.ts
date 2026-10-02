import { parseArgs } from '@std/cli/parse-args'
import { toText } from '@std/streams/to-text'
import { handleCliError } from '../utils/cli.utils.ts'
import { readConfigText } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safe, safeAsync } from '../utils/safe.utils.ts'
import { failClosed, runHook } from './hook.ts'

const KNOWN_FLAGS = new Set(['help', 'h'])

const args = parseArgs(Deno.args, {
  boolean: ['help'],
  alias: { h: 'help' },
})

const printHelp = (): void => {
  const lines = [
    'Usage: tagline                 read a PreToolUse hook payload on stdin and gate gh body writes',
    '',
    'Reads the Claude Code PreToolUse JSON payload from stdin. When the Bash command',
    'contains a gh invocation whose issue/PR body or comment is missing the',
    'attribution tagline, it exits 2 and prints the reason to stderr, which blocks',
    'the tool call. Every other command exits 0.',
    '',
    'The tagline comes from the tagline section of the tools.config.json in',
    "CLAUDE_PROJECT_DIR, or in the payload's cwd when that is unset. A body write",
    'is blocked when that config is missing or unreadable. A relative body file is',
    "read from the payload's cwd.",
    '',
    'Options:',
    '  --help, -h                   Show this help',
  ]

  console.log(lines.join('\n'))
}

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const checkUsage = (): void => {
  const [unknown] = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.has(key))
  if (unknown) throw new CliError(`Unknown option: "${unknown.length === 1 ? '-' : '--'}${unknown}"`, ['tagline takes no option but --help'])

  const [argument] = args._
  if (argument !== undefined) throw new CliError(`Unexpected argument: "${argument}"`, ['tagline reads a hook payload on stdin and takes no arguments'])
}

const usage = safe(checkUsage)
if (usage.error && Deno.stdin.isTerminal()) handleCliError(usage.error)

const { data: raw, error: readError } = await safeAsync(() => toText(Deno.stdin.readable))

// Without the payload nothing says whether the command writes a body, so the call is blocked.
if (readError) {
  console.error(`Blocked: the tagline hook could not read its payload: ${readError.message}`)
  Deno.exit(2)
}

const decide = async () => {
  if (usage.error) throw usage.error

  return await runHook({
    raw,
    readProjectDir: () => {
      const { state } = Deno.permissions.querySync({ name: 'env', variable: 'CLAUDE_PROJECT_DIR' })
      if (state !== 'granted') {
        throw new CliError('The hook command cannot read CLAUDE_PROJECT_DIR', ['Add --allow-env=CLAUDE_PROJECT_DIR to the hook command'])
      }

      return Deno.env.get('CLAUDE_PROJECT_DIR')
    },
    readConfig: readConfigText,
    readFile: (path) => Deno.readTextFileSync(path),
  })
}

const { data: result, error } = await safeAsync(decide)

if (error) {
  const failure = failClosed(raw, error)
  console.error(failure.message)
  Deno.exit(failure.code)
}

if (result.message) console.error(result.message)

Deno.exit(result.code)
