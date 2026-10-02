import { parseArgs } from '@std/cli/parse-args'

export type CommandLine = {
  help: boolean
  positionals: string[]
  unknownFlags: string[]
}

const KNOWN_FLAGS: readonly string[] = ['help', 'h']

// Positionals stay strings, since the parser would store an item like `1.50` as 1.5.
export const parseCommandLine = (argv: string[]): CommandLine => {
  const args = parseArgs(argv, {
    alias: { h: 'help' },
    boolean: ['help'],
    string: ['_'],
  })

  const unknownKeys = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.includes(key))

  // Each unknown flag is named as typed, with one dash for a short flag and two for a long one.
  const unknownFlags = unknownKeys.map((key) => {
    const long = argv.find((token) => token === `--${key}` || token.startsWith(`--${key}=`) || token === `--no-${key}`)
    if (!long) return `-${key}`

    const [flag] = long.split('=')

    return flag
  })

  return { help: args.help, positionals: args._.map(String), unknownFlags }
}

export type SectionSplit = {
  words: string[]
  section: string | null
  sectionWordCount: number
}

// Splits the section off after the last `in`, keeping a trailing `in` as text unless after `in`.
export const splitSection = (args: string[]): SectionSplit => {
  const inAt = args.lastIndexOf('in')
  if (inAt === -1) return { words: args, section: null, sectionWordCount: 0 }

  if (inAt === args.length - 1) {
    const [before] = args.slice(inAt - 1, inAt)
    if (before !== 'in') return { words: args, section: null, sectionWordCount: 0 }

    return { words: args.slice(0, inAt - 1), section: 'in', sectionWordCount: 1 }
  }

  const after = args.slice(inAt + 1)

  return { words: args.slice(0, inAt), section: after.join(' '), sectionWordCount: after.length }
}
