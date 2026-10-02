import { z } from 'zod'
import { CliError } from '../utils/error.utils.ts'
import { safe } from '../utils/safe.utils.ts'

// An empty anchor matches at the start of every file, so it would prepend `after` and score a broken file as caught.
const mutationInput = z.object({
  name: z.string().min(1),
  before: z.string().min(1),
  after: z.string(),
})

export type Mutation = z.infer<typeof mutationInput>

const targetInput = z.object({
  // Directory the test command runs in, resolved from the directory the tool is called from.
  dir: z.string(),
  cmd: z.string(),
  source: z.string(),
  mutations: z.array(mutationInput),
})

export type Target = z.infer<typeof targetInput>

export type LoadedTarget = {
  target: Target
  sourcePath: string
  original: string
}

export type Verdict = {
  name: string
  source: string
  // A mutation the suite failed on is one the tests actually check; one it passed on is coverage that proves nothing.
  caught: boolean
}

const KNOWN_FLAGS: readonly string[] = ['help', 'h', 'plan', 'p', 'source', 's']

export type ArgsInput = {
  positionals: string[]
  keys: string[]
  plan: string | undefined
  help: boolean
}

// Refuses what the parser would otherwise absorb, since an unread flag leaves the run doing something else.
export const assertArgs = (input: ArgsInput): void => {
  const { positionals, keys, plan, help } = input

  const [unexpected] = positionals
  if (unexpected !== undefined) {
    throw new CliError(`Unexpected argument: "${unexpected}"`, ['Name the plan as --plan <path>', 'Run with --help for usage'])
  }

  const [unknown] = keys.filter((key) => key !== '_' && !KNOWN_FLAGS.includes(key))
  if (unknown) throw new CliError(`Unknown option: "--${unknown}"`, ['Run with --help for usage'])

  if (help) return

  if (plan === undefined) throw new CliError('Missing --plan', ['Pass --plan <path> naming a json file of targets'])
  if (!plan) throw new CliError('Empty --plan value', ['Pass --plan <path>, resolved from the directory the task is called from'])
}

// The task grants run access to this program alone, so a cmd naming another fails only after its source is mutated.
const RUNNABLE_PROGRAM = 'deno'

// The plan crosses in from a file, so it is checked rather than trusted to be the shape the run reads.
export const readPlan = (text: string, path: string): Target[] => {
  const { data: parsed, error } = safe((): unknown => JSON.parse(text))
  if (error) throw new CliError(`Plan at ${path} is not valid JSON: ${error.message}`, ['Fix the JSON, which holds an array of targets'])

  if (!Array.isArray(parsed)) {
    throw new CliError('Plan must be a json array of targets', ['Each target names dir, cmd, source, and mutations'])
  }

  const plan = z.array(targetInput).safeParse(parsed)
  if (!plan.success) {
    throw new CliError('Plan carries a target the run cannot read', ['Each target needs dir, cmd, source, and mutations of name, before, after'])
  }

  for (const target of plan.data) {
    const [program] = target.cmd.split(' ')
    if (program !== RUNNABLE_PROGRAM) {
      throw new CliError(`Target for ${target.source} runs "${target.cmd}", which the tool may not run`, [`Start cmd with ${RUNNABLE_PROGRAM}, the only program the task lets the tool run`])
    }
  }

  return plan.data
}

// Applies one mutation, refusing an anchor the source does not carry so a typo never reads as a caught mutation.
export const applyMutation = (source: string, mutation: Mutation): string => {
  if (!source.includes(mutation.before)) {
    throw new CliError(`Anchor not found for "${mutation.name}"`, ['Copy the anchor from the source file exactly', 'Whitespace and line breaks are part of the match'])
  }

  return source.replace(mutation.before, mutation.after)
}

// Applies every mutation once without writing, so an anchor a later target lacks is refused before the first verdict.
export const assertAnchors = (loaded: LoadedTarget[]): void => {
  for (const { target, original } of loaded) {
    for (const mutation of target.mutations) {
      applyMutation(original, mutation)
    }
  }
}

export const survivors = (verdicts: Verdict[]): Verdict[] => verdicts.filter((verdict) => !verdict.caught)

export const formatVerdict = (verdict: Verdict): string => `  ${verdict.caught ? 'caught  ' : 'SURVIVED'}  ${verdict.name}`

// Names what a survivor means rather than only that one exists, since the count alone reads as a test failure.
export const formatSummary = (verdicts: Verdict[]): string => {
  const left = survivors(verdicts)
  if (left.length === 0) return `No survivors: all ${verdicts.length} mutations were caught.`

  const lines = [`${left.length} of ${verdicts.length} mutations survived, so the tests run these paths without checking them:`]
  for (const verdict of left) {
    lines.push(`  ${verdict.source}: ${verdict.name}`)
  }

  return lines.join('\n')
}
