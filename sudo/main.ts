import { join } from '@std/path'
import { handleCliError, unwrap } from '../utils/cli.utils.ts'
import { callerDirectory } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safeAsync } from '../utils/safe.utils.ts'
import { parseInvocation } from './args.ts'
import { askpassScript } from './askpass.ts'

type Askpass = {
  dir: string
  path: string
  [Symbol.asyncDispose]: () => Promise<void>
}

const invocation = parseInvocation(Deno.args)

const printHelp = (): void => {
  const lines = [
    'Usage: sudo <command> [args...]',
    '',
    'Run a privileged command with a password prompt that needs no tty.',
    'Uses the helper named by SUDO_ASKPASS when set, as sudo itself does.',
    'Otherwise macOS shows an osascript dialog, and every other platform',
    'tries ssh-askpass, zenity, kdialog, then /dev/tty.',
    '',
    'Options:',
    '  --help, -h          Show this help',
  ]

  console.log(lines.join('\n'))
}

if (invocation.unknownFlags.length) {
  const suggestions = ['Put the command first, since every flag after it goes to the command', 'Run with --help for usage']
  handleCliError(new CliError(`Unknown flag: ${invocation.unknownFlags.join(', ')}`, suggestions))
}

if (invocation.help) {
  printHelp()
  Deno.exit(0)
}

const writeAskpass = async (): Promise<Askpass> => {
  const dir = await Deno.makeTempDir({ prefix: 'sudo-askpass-' })
  const path = join(dir, 'askpass.sh')
  await Deno.writeTextFile(path, askpassScript(Deno.build.os))
  await Deno.chmod(path, 0o700)

  return {
    dir,
    path,
    [Symbol.asyncDispose]: async () => {
      const { error } = await safeAsync(() => Deno.remove(dir, { recursive: true }))
      if (error) console.error(`warning: Removing ${dir} failed: ${error.message}`)
    },
  }
}

const runSudo = async (askpassPath: string): Promise<number> => {
  const command = new Deno.Command('sudo', {
    args: ['-A', '--', ...invocation.command],
    cwd: callerDirectory(),
    env: { SUDO_ASKPASS: askpassPath },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const { data: output, error: spawnError } = await safeAsync(() => command.output())
  const isMissing = spawnError instanceof Deno.errors.NotFound
  if (isMissing) throw new CliError('Could not find sudo', ['Install sudo, or put the directory holding it on PATH'])
  if (spawnError) throw spawnError

  return output.code
}

const run = async (): Promise<number> => {
  const suggestions = ['Pass the command and its arguments after sudo', 'Run with --help for usage']
  if (!invocation.command.length) throw new CliError('Missing command', suggestions)

  // A helper the user already set wins, as it does for sudo itself.
  const configured = Deno.env.get('SUDO_ASKPASS')
  if (configured) return await runSudo(configured)

  await using askpass = await writeAskpass()

  return await runSudo(askpass.path)
}

const code = unwrap(await safeAsync(() => run()))

Deno.exit(code)
