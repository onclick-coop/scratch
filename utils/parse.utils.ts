import { CliError } from './error.utils.ts'

// Digits only, because `Number` reads hex and scientific notation as whole numbers, and because parseArgs
// hands a value like `-5` to the next flag and leaves an empty string that would otherwise pass as absent.
export const countPattern = /^\d+$/

// Past this a count renders back as scientific notation, which a wrapped command reads as its leading
// digit and acts on silently, so the bound refuses the value rather than letting it through changed.
const MAX_COUNT = 1_000_000

// Reads a positive whole count from a flag, falling back when the flag is absent.
export const parseCount = (value: string | undefined, fallback: number, flag: string): number => {
  if (value === undefined) return fallback

  // The pattern admits `0`, which is digits but not a count, so the bounds are the rest of the same rule.
  const count = Number(value)
  if (!countPattern.test(value) || count === 0 || count > MAX_COUNT) {
    throw new CliError(`Invalid ${flag} value: "${value}"`, [`Pass a whole number between 1 and ${MAX_COUNT}`])
  }

  return count
}

// Parses a comma-separated list of non-negative integers like "0,2,5".
// Throws CliError on empty input or any non-integer part.
export const parseIntegerList = (raw: string): number[] => {
  const parts = raw.split(',')
  const nums: number[] = []

  for (const part of parts) {
    const trimmed = part.trim()
    const parsed = Number(trimmed)
    if (trimmed === '' || !Number.isInteger(parsed) || parsed < 0) {
      throw new CliError(`Invalid integer list: "${raw}"`, ['Use comma-separated non-negative integers, e.g. `0,2,3`'])
    }

    nums.push(parsed)
  }

  if (nums.length === 0) {
    throw new CliError('No values provided', ['Provide at least one integer'])
  }

  return nums
}

export type Invocation = {
  command: string
  argument: string | undefined
}

export type InvocationInput = {
  positionals: string[]
  commands: readonly string[]
  withArgument: readonly string[]
  fallback: string
  unknownFlags: string[]
}

// Reads the verb and its one argument from a tool's positionals, refusing anything the tool does not
// declare. A tool whose verbs are positions cannot be handed two at once, unlike a set of boolean flags.
export const toInvocation = (input: InvocationInput): Invocation => {
  const { positionals, commands, withArgument, fallback, unknownFlags } = input

  const [unknown] = unknownFlags
  if (unknown) throw new CliError(`Unknown option: "--${unknown}"`, [`Commands are words, not flags: ${commands.join(', ')}`, 'Run with --help for usage'])

  const [command = fallback, argument, ...rest] = positionals
  if (rest.length) throw new CliError(`Unexpected argument: "${rest[0]}"`, ['Pass one argument after the command', 'Quote a value containing spaces'])

  if (!commands.some((entry) => entry === command)) {
    throw new CliError(`Unknown command: "${command}"`, [`Valid commands: ${commands.join(', ')}`, 'Run with --help for usage'])
  }

  if (argument !== undefined && !withArgument.some((entry) => entry === command)) {
    throw new CliError(`The ${command} command takes no argument`, [`Commands taking an argument: ${withArgument.join(', ')}`])
  }

  return { command, argument }
}
