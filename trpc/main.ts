import { parseArgs } from '@std/cli/parse-args'
import { handleCliError } from '../utils/cli.utils.ts'
import { callerDirectory, readConfigText } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safe, safeAsync } from '../utils/safe.utils.ts'
import { callProcedure } from './client.ts'
import { parseConfig, resolveUrl } from './config.ts'
import { unknownOptionError } from './error.ts'
import { authHeaders, tokenAt } from './session.ts'
import { readSessions, sessionsPath, writeSessions } from './store.ts'
import { parseMarkers } from './temporal.ts'

const COMMANDS: readonly string[] = ['status', 'logout']
const KNOWN_FLAGS = new Set(['help', 'h', 'url'])

const args = parseArgs(Deno.args, {
  string: ['url', '_'],
  boolean: ['help'],
  alias: { h: 'help' },
})

const printHelp = (): void => {
  const lines = [
    'Usage: trpc <procedure> [<json-input>] [--url <url>]',
    '       trpc status [--url <url>]',
    '       trpc logout [--url <url>]',
    '',
    'Calls a procedure on a tRPC server and prints its result as JSON.',
    'A query or a mutation alike, since a mutation refused for its kind is retried as a query.',
    '',
    'Commands:',
    '  <procedure> [<json-input>]   Call the procedure at its dotted path, with the JSON as its input',
    '  status                       Print whether a token is saved for the url',
    '  logout                       Forget the token saved for the url',
    '',
    'Options:',
    '  --url <url>                  The url the tRPC handler is mounted at (default: url in tools.config.json)',
    '  --help, -h                   Show this help',
    '',
    'Settings come from the trpc section of the tools.config.json in the directory deno task was called from.',
    'A string such as "@instant:2026-07-01T15:00:00Z" in the input is sent as that Temporal value.',
    'An input starting with a dash, such as a negative number, goes after --.',
    'A procedure listed under session.procedures saves the token its result carries, and later calls to the same url send it.',
  ]

  console.log(lines.join('\n'))
}

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const run = async (): Promise<void> => {
  const [unknown] = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.has(key))
  if (unknown) throw unknownOptionError(unknown)

  const [command, inputText, ...rest] = args._.map(String)
  if (!command) throw new CliError('No procedure named', ['Pass a dotted procedure path such as post.list', 'Run with --help for usage'])
  if (rest.length) throw new CliError(`Unexpected argument: "${rest[0]}"`, ['Pass the input as one JSON argument', 'Quote it so the shell keeps it whole'])

  const isCommand = COMMANDS.includes(command)
  if (isCommand && inputText !== undefined) throw new CliError(`The ${command} command takes no input`, ['Pass only the command'])

  const config = parseConfig(await readConfigText(callerDirectory()))
  const url = resolveUrl(config, args.url)
  const path = sessionsPath()
  const sessions = await readSessions(path)

  if (command === 'status') {
    console.log(JSON.stringify({ url, signedIn: Object.hasOwn(sessions, url) }, null, 2))

    return
  }

  if (command === 'logout') {
    const { [url]: _signedOut, ...remaining } = sessions
    await writeSessions(remaining, path)
    console.error(`signed out of ${url}`)

    return
  }

  let input: unknown = undefined
  if (inputText !== undefined) {
    const { data: json, error } = safe((): unknown => JSON.parse(inputText))
    if (error) throw new CliError(`Invalid JSON input: ${error.message}`, ['Quote the input so the shell passes it unchanged'])

    input = parseMarkers(json)
  }

  const headers = authHeaders({ sessions, url, auth: config.auth })
  const result = await callProcedure({ url, transformer: config.transformer, headers, procedure: command, input })

  // Printed before any token is saved, so a failed write cannot swallow the answer.
  console.log(JSON.stringify(result ?? null, null, 2))

  const { session } = config
  if (!session || !session.procedures.includes(command)) return

  const token = tokenAt(result, session.tokenPath)
  await writeSessions({ ...sessions, [url]: { token } }, path)
  console.error(`saved session for ${url} to ${path}`)
}

const { error } = await safeAsync(() => run())
if (error) handleCliError(error)

Deno.exit(0)
