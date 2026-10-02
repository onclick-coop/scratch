import { parseArgs } from '@std/cli/parse-args'

const KNOWN_FLAGS = new Set(['_', '--', 'help', 'h'])

type Invocation = {
  help: boolean
  unknownFlags: string[]
  command: string[]
}

// Reads the tool's own flags up to the first word, which starts the command, and keeps the command's own `--`.
export const parseInvocation = (argv: string[]): Invocation => {
  const args = parseArgs(argv, {
    alias: { h: 'help' },
    boolean: ['help'],
    stopEarly: true,
    '--': true,
  })

  const unknownKeys = Object.keys(args).filter((key) => !KNOWN_FLAGS.has(key))
  const unknownFlags = unknownKeys.map((key) => (key.length === 1 ? `-${key}` : `--${key}`))
  const words = args._.map(String)
  const afterDash = args['--']
  const command = words.length ? [...words] : [...afterDash]
  // A `--` before any word leaves no words, so one present beside words is the command's own.
  if (words.length && argv.includes('--')) command.push('--', ...afterDash)

  return {
    help: args.help,
    unknownFlags,
    command,
  }
}
