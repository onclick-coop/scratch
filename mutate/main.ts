import { parseArgs } from '@std/cli/parse-args'
import { resolve } from '@std/path'
import { handleCliError } from '../utils/cli.utils.ts'
import { callerDirectory } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safe, safeAsync } from '../utils/safe.utils.ts'
import { applyMutation, assertAnchors, assertArgs, formatSummary, formatVerdict, type LoadedTarget, readPlan, type Target, type Verdict } from './parse.ts'

const args = parseArgs(Deno.args, {
  string: ['plan', 'source'],
  boolean: ['help'],
  alias: { h: 'help', p: 'plan', s: 'source' },
})

const printHelp = (): void => {
  const lines = [
    'Usage: mutate --plan <path> [--source <path>]',
    '',
    'Proves test coverage is real by breaking one behavior at a time and checking the suite fails.',
    'A mutation the suite passes on is a path the tests run without checking what it does.',
    '',
    'Options:',
    '  --plan,   -p <path>  A json array of targets, resolved from the directory the task is called from',
    '  --source, -s <path>  Run only the target whose source matches, for iterating on one file',
    '  --help,   -h         Show this help',
    '',
    'Each target names:',
    '  dir        the directory the test command runs in, resolved from the directory the task is called from',
    '  cmd        the test command, which must fail when the mutation is caught',
    '  source     the file to mutate, resolved from dir',
    '  mutations  a list of { name, before, after }, where before is copied from the source exactly',
    '',
    'The source file is restored after every mutation, including when the run is interrupted.',
  ]

  console.log(lines.join('\n'))
}

const root = callerDirectory()

let running: Deno.ChildProcess | undefined

// Answers whether the suite failed, which is what a caught mutation looks like.
const suiteFails = async (target: Target): Promise<boolean> => {
  const [bin, ...rest] = target.cmd.split(' ')
  if (!bin) throw new CliError(`Target for ${target.source} carries an empty cmd`, ['Name the test command the suite runs'])

  running = new Deno.Command(bin, { args: rest, cwd: resolve(root, target.dir), stdout: 'null', stderr: 'null' }).spawn()
  const { code } = await running.status
  running = undefined

  return code !== 0
}

const runTarget = async (loaded: LoadedTarget): Promise<Verdict[]> => {
  const { target, sourcePath, original } = loaded

  console.error(`\n=== ${target.source} ===`)

  const verdicts: Verdict[] = []

  // Exits with the code a shell reports for a process the signal ended.
  const restoreAndExit = (code: number): void => {
    const child = running
    if (child) {
      const { error: killError } = safe(() => child.kill('SIGTERM'))
      if (killError) console.error(`Could not stop the test command: ${killError.message}`)
    }

    Deno.writeTextFileSync(sourcePath, original)
    console.error(`\nInterrupted, so ${target.source} was restored`)
    Deno.exit(code)
  }

  const onInterrupt = (): void => restoreAndExit(130)
  const onTerminate = (): void => restoreAndExit(143)

  Deno.addSignalListener('SIGINT', onInterrupt)
  Deno.addSignalListener('SIGTERM', onTerminate)

  // The restore runs on a throw as well as a return, and the signal listeners cover an interrupt.
  try {
    for (const mutation of target.mutations) {
      // Writes stay synchronous so no write is in flight when an interrupt restores the source.
      Deno.writeTextFileSync(sourcePath, applyMutation(original, mutation))

      const caught = await suiteFails(target)
      Deno.writeTextFileSync(sourcePath, original)

      const verdict = { name: mutation.name, source: target.source, caught }
      verdicts.push(verdict)
      console.error(formatVerdict(verdict))
    }
  } finally {
    Deno.writeTextFileSync(sourcePath, original)
    Deno.removeSignalListener('SIGINT', onInterrupt)
    Deno.removeSignalListener('SIGTERM', onTerminate)
  }

  return verdicts
}

const run = async (): Promise<void> => {
  const planPath = resolve(root, args.plan ?? '')

  const { data: planText, error: readError } = await safeAsync(() => Deno.readTextFile(planPath))
  if (readError) throw new CliError(`Cannot read the plan at ${planPath}`, ['Check the path, which is resolved from the directory the task is called from'])

  const plan = readPlan(planText, planPath)

  const targets = args.source ? plan.filter((target) => target.source === args.source) : plan
  if (targets.length === 0) {
    throw new CliError(`No target names the source "${args.source}"`, [`Sources in the plan: ${plan.map((target) => target.source).join(', ')}`])
  }

  const loaded: LoadedTarget[] = []
  for (const target of plan) {
    const sourcePath = resolve(root, target.dir, target.source)

    const { data: original, error: sourceError } = await safeAsync(() => Deno.readTextFile(sourcePath))
    if (sourceError) throw new CliError(`Cannot read the source at ${sourcePath}`, ['Check that source resolves from dir'])

    loaded.push({ target, sourcePath, original })
  }

  assertAnchors(loaded)

  const verdicts: Verdict[] = []
  for (const entry of loaded) {
    if (!targets.includes(entry.target)) continue

    verdicts.push(...await runTarget(entry))
  }

  console.error('')
  console.log(formatSummary(verdicts))
}

const { error: argsError } = safe(() => assertArgs({ positionals: args._.map(String), keys: Object.keys(args), plan: args.plan, help: args.help }))
if (argsError) handleCliError(argsError)

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const { error } = await safeAsync(run)
if (error) handleCliError(error)

Deno.exit(0)
