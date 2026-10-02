import { stripAnsi, stripCursorCodes } from '../utils/ansi.utils.ts'
import { CliError } from '../utils/error.utils.ts'

export const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

export type Level = typeof LEVELS[number]

export const isLevel = (value: string): value is Level => LEVELS.some((level) => level === value)

export type ArgsInput = {
  positionals: string[]
  keys: string[]
  level: string | undefined
  cat: string | undefined
}

const KNOWN_FLAGS: readonly string[] = ['help', 'h', 'level', 'l', 'cat', 'c', 'file', 'f', 'service', 's', 'no-follow']

// Refuses input the parser would absorb, since an unread flag changes what the run does.
export const assertArgs = (input: ArgsInput): void => {
  const { positionals, keys, level, cat } = input

  const [unexpected] = positionals
  if (unexpected !== undefined) {
    throw new CliError(`Unexpected argument: "${unexpected}"`, ['Name the service as --service <name>', 'Run with --help for usage'])
  }

  const [unknown] = keys.filter((key) => key !== '_' && !KNOWN_FLAGS.includes(key))
  if (unknown) {
    const flag = unknown.length === 1 ? `-${unknown}` : `--${unknown}`
    throw new CliError(`Unknown option: "${flag}"`, ['Run with --help for usage'])
  }

  if (level !== undefined && !isLevel(level)) throw new CliError(`Unknown level: "${level}"`, [`Valid levels: ${LEVELS.join(', ')}`])

  // An empty substring matches every category, so the filter would narrow nothing.
  if (cat === '') throw new CliError('Empty --cat value', ['Pass a substring of a category, such as `tarpit`'])
}

const LEVEL_TOKENS: Record<string, Level> = {
  TRC: 'trace',
  DBG: 'debug',
  INF: 'info',
  WRN: 'warn',
  ERR: 'error',
  FTL: 'fatal',
}

// Matches a logtape header's timestamp, level token, and category, capturing the last two.
export const headerPattern = /^\s*\d{2}:\d{2}:\d{2}\.\d{3}\s+([A-Z]{3})\s+(\S+)\s/

export type Parsed = {
  level: Level | null
  category: string | null
}

export type Filter = {
  minLevel: Level | null
  category: string | null
}

export const parseLine = (line: string): Parsed => {
  // gprocs writes cursor moves ahead of a watcher's header, which would otherwise hide it.
  const match = headerPattern.exec(stripCursorCodes(stripAnsi(line)))
  if (!match) return { level: null, category: null }

  const [, levelToken, category] = match
  const level = LEVEL_TOKENS[levelToken] ?? null

  return { level, category }
}

// A headerless line passes, so a stack trace or watcher output is never silently dropped.
export const matches = (line: string, filter: Filter): boolean => {
  const { level, category } = parseLine(line)
  if (level === null) return true

  if (filter.minLevel && LEVELS.indexOf(level) < LEVELS.indexOf(filter.minLevel)) return false
  if (filter.category && !(category ?? '').includes(filter.category)) return false

  return true
}
