import type { Word } from './shell.ts'

// A shell variable assignment, which runs before the command it prefixes.
export const assignmentPattern = /^[A-Za-z_][A-Za-z0-9_]*\+?=/

type Wrapper = {
  values: readonly string[]
  operands: number
}

const reservedWords: readonly string[] = ['{', '!', 'if', 'then', 'else', 'elif', 'do', 'while', 'until']

// Commands that run another, with their value-taking options and the operands before the command.
const wrappers: Record<string, Wrapper> = {
  command: { values: [], operands: 0 },
  env: { values: ['-u', '--unset', '-C', '--chdir', '-S', '--split-string'], operands: 0 },
  exec: { values: ['-a'], operands: 0 },
  nice: { values: ['-n', '--adjustment'], operands: 0 },
  nohup: { values: [], operands: 0 },
  setsid: { values: [], operands: 0 },
  stdbuf: { values: ['-i', '-o', '-e', '--input', '--output', '--error'], operands: 0 },
  sudo: {
    values: ['-u', '--user', '-g', '--group', '-C', '--close-from', '-D', '--chdir', '-h', '--host', '-p', '--prompt', '-r', '--role', '-t', '--type', '-U', '--other-user', '-T', '--command-timeout', '-R', '--chroot'],
    operands: 0,
  },
  time: { values: [], operands: 0 },
  timeout: { values: ['-s', '--signal', '-k', '--kill-after'], operands: 1 },
}

export const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

// Drops leading options and the values they take.
export const skipOptions = (words: Word[], valueFlags: readonly string[]): Word[] => {
  let index = 0

  while (index < words.length) {
    const [word] = words.slice(index)
    if (!word) break

    const { text } = word
    if (text === '--') return words.slice(index + 1)
    if (!text.startsWith('-')) break

    const letters = text.startsWith('--') ? '' : text.slice(1)
    const valueAt = [...letters].findIndex((letter) => valueFlags.includes(`-${letter}`))
    const takesNext = valueFlags.includes(text) || (letters.length > 1 && valueAt === letters.length - 1)
    index += takesNext ? 2 : 1
  }

  return words.slice(index)
}

// Drops the reserved words, assignments, and wrappers that come before the command that runs.
export const stripPrefixes = (words: Word[]): Word[] => {
  let rest = words

  while (rest.length > 0) {
    const [first, ...others] = rest
    if (!first) return []

    if (reservedWords.includes(first.text) || assignmentPattern.test(first.text)) {
      rest = others
      continue
    }

    const name = basename(first.text)
    if (!Object.hasOwn(wrappers, name)) return rest

    const { values, operands } = wrappers[name]
    rest = skipOptions(others, values).slice(operands)
  }

  return rest
}
