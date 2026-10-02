import { isAbsolute, join, normalize, resolve } from '@std/path/posix'
import { basename, stripPrefixes } from './command.ts'
import type { BodySource } from './parser.ts'
import { descriptorPattern, expansionPattern, type ShellCommand, type Word } from './shell.ts'

// Text a command is known to produce, or `runtime` when only running it would tell.
export type Content = {
  text: string
  runtime: boolean
}

type Directory = {
  path: string
  dynamic: boolean
}

// What the script has done before the command being read: where it is, and what it wrote where.
export type ScriptState = {
  cwd: string
  directory: Directory
  stack: Directory[]
  writes: Map<string, Content>
  unknownWrite: boolean
}

// An echo option cluster, such as `-n` or `-ne`, which echo reads as options rather than text.
export const echoOptionPattern = /^-[neE]+$/

// An option to cd, pushd, or popd, as opposed to the directory operand.
export const directoryOptionPattern = /^-[LPe@n]+$/

// A pushd or popd operand that rotates the directory stack rather than naming a directory.
export const stackRotationPattern = /^[+-]\d+$/

const RUNTIME: Content = { text: '', runtime: true }

const writeOperators: readonly string[] = ['>', '>>', '>|', '>&', '&>', '&>>']

const escapes: Record<string, string> = { n: '\n', t: '\t', r: '\r', a: '\u{7}', b: '\b', f: '\f', v: '\v', e: '\u{1B}', '\\': '\\' }

const fileKinds: Record<string, BodySource['kind']> = { file: 'written', 'json-file': 'written-json', 'graphql-file': 'written-graphql' }

export const createState = (cwd: string): ScriptState => {
  return { cwd, directory: { path: '', dynamic: false }, stack: [], writes: new Map(), unknownWrite: false }
}

const unescape = (text: string): string => {
  let result = ''
  let index = 0

  while (index < text.length) {
    const char = text.charAt(index)
    const next = text.charAt(index + 1)

    if (char === '\\' && next && Object.hasOwn(escapes, next)) {
      result += escapes[next]
      index += 2
      continue
    }

    result += char
    index += 1
  }

  return result
}

// Formats printf's %s and %b, reusing the format while arguments remain as printf does.
const formatPrintf = (format: string, args: string[]): Content => {
  let text = ''
  let remaining = args
  let again = true

  while (again) {
    let used = 0
    let index = 0

    while (index < format.length) {
      const char = format.charAt(index)
      const next = format.charAt(index + 1)

      if (char === '\\' && next) {
        text += unescape(char + next)
        index += 2
        continue
      }

      if (char === '%' && next === '%') {
        text += '%'
        index += 2
        continue
      }

      if (char === '%') {
        if (next !== 's' && next !== 'b') return RUNTIME

        const [arg = '', ...rest] = remaining
        text += next === 'b' ? unescape(arg) : arg
        remaining = rest
        used += 1
        index += 2
        continue
      }

      text += char
      index += 1
    }

    again = remaining.length > 0 && used > 0
  }

  return { text, runtime: false }
}

const formatEcho = (args: string[]): Content => {
  let newline = true
  let interprets = false
  let index = 0

  while (index < args.length && echoOptionPattern.test(args[index] ?? '')) {
    const option = args[index] ?? ''
    if (option.includes('n')) newline = false
    if (option.includes('e')) interprets = true
    if (option.includes('E')) interprets = false
    index += 1
  }

  const text = args.slice(index).join(' ')

  return { text: (interprets ? unescape(text) : text) + (newline ? '\n' : ''), runtime: false }
}

// What a command reads on stdin: its heredoc, its here-string, or what its pipeline feeds it.
const inputOf = (command: ShellCommand): Content => {
  const [heredoc, ...moreHeredocs] = command.heredocs

  if (heredoc && moreHeredocs.length === 0) {
    if (!heredoc.quoted && expansionPattern.test(heredoc.body)) return RUNTIME

    return { text: `${heredoc.body}\n`, runtime: false }
  }

  const hereStrings = command.redirects.filter((redirect) => redirect.operator === '<<<')
  const [hereString] = hereStrings
  if (hereString && hereStrings.length === 1) return hereString.target.dynamic ? RUNTIME : { text: `${hereString.target.text}\n`, runtime: false }

  const readsFile = command.redirects.some((redirect) => redirect.operator === '<')
  const [upstream] = command.upstream
  if (readsFile || !upstream) return RUNTIME

  return outputOf(upstream)
}

// What a command prints, known only for echo, printf, and cat or tee passing on known input.
const outputOf = (command: ShellCommand): Content => {
  const [executable, ...args] = stripPrefixes(command.words)
  if (!executable || executable.dynamic) return RUNTIME

  const name = basename(executable.text)
  const texts = args.map((arg) => arg.text)
  const isLiteral = args.every((arg) => !arg.dynamic)

  if (name === 'echo') return isLiteral ? formatEcho(texts) : RUNTIME

  if (name === 'printf') {
    const [first, ...rest] = texts[0] === '--' ? texts.slice(1) : texts
    if (!isLiteral || first === undefined || first === '-v') return RUNTIME

    return formatPrintf(first, rest)
  }

  if (name === 'cat') {
    const readsFiles = texts.some((text) => !text.startsWith('-'))

    return readsFiles ? RUNTIME : inputOf(command)
  }

  if (name === 'tee') return inputOf(command)

  return RUNTIME
}

const keyOf = (state: ScriptState, path: string): string => resolve(state.cwd, state.directory.path || '.', path)

const write = (state: ScriptState, target: Word, append: boolean, content: Content): void => {
  const isUnplaced = target.dynamic || (state.directory.dynamic && !isAbsolute(target.text))
  if (isUnplaced) {
    state.unknownWrite = true

    return
  }

  const key = keyOf(state, target.text)
  const prior = state.writes.get(key)
  const isKnownAppend = append && prior !== undefined && !prior.runtime && !content.runtime

  if (isKnownAppend) {
    state.writes.set(key, { text: prior.text + content.text, runtime: false })

    return
  }

  state.writes.set(key, append ? RUNTIME : content)
}

const copiedContent = (state: ScriptState, source: Word): Content => {
  if (source.dynamic || state.directory.dynamic) return RUNTIME

  return state.writes.get(keyOf(state, source.text)) ?? RUNTIME
}

const recordCopy = (state: ScriptState, args: Word[]): void => {
  const operands: Word[] = []
  let targetDirectory: Word = { text: '', dynamic: false }
  let index = 0

  while (index < args.length) {
    const [word, next] = args.slice(index)
    if (!word) break

    if (word.text === '--') {
      operands.push(...args.slice(index + 1))
      break
    }

    if (word.text === '-t' && next) {
      targetDirectory = next
      index += 2
      continue
    }

    if (word.text.startsWith('--target-directory=')) targetDirectory = { text: word.text.slice('--target-directory='.length), dynamic: word.dynamic }
    if (!word.text.startsWith('-')) operands.push(word)
    index += 1
  }

  if (targetDirectory.text) {
    for (const source of operands) {
      const target = { text: join(targetDirectory.text, basename(source.text)), dynamic: targetDirectory.dynamic || source.dynamic }
      write(state, target, false, copiedContent(state, source))
    }

    return
  }

  const destination = operands.at(-1)
  if (!destination) return

  for (const source of operands.slice(0, -1)) {
    const content = copiedContent(state, source)
    write(state, destination, false, content)
    write(state, { text: join(destination.text, basename(source.text)), dynamic: destination.dynamic || source.dynamic }, false, content)
  }
}

// Records what a command writes to files, through its redirections, tee, cp, or mv.
export const recordWrites = (command: ShellCommand, state: ScriptState): void => {
  for (const { operator, target } of command.redirects) {
    if (!writeOperators.includes(operator)) continue

    const isDuplicate = operator === '>&' && (descriptorPattern.test(target.text) || target.text === '-')
    if (isDuplicate) continue

    write(state, target, operator.endsWith('>>'), outputOf(command))
  }

  const [executable, ...args] = stripPrefixes(command.words)
  if (!executable) return

  const name = basename(executable.text)

  if (name === 'tee') {
    const append = args.some((arg) => arg.text === '-a' || arg.text === '--append')
    const content = inputOf(command)

    for (const target of args.filter((arg) => !arg.text.startsWith('-'))) {
      write(state, target, append, content)
    }
  }

  if (name === 'cp' || name === 'mv') recordCopy(state, args)
}

const moveTo = (state: ScriptState, path: string): void => {
  if (isAbsolute(path)) {
    state.directory = { path: normalize(path), dynamic: false }

    return
  }

  if (!state.directory.dynamic) state.directory = { path: normalize(join(state.directory.path || '.', path)), dynamic: false }
}

// Follows a cd, pushd, or popd, losing the directory when its target is only known at run time.
export const changeDirectory = (name: string, args: Word[], state: ScriptState): void => {
  const operands = args.filter((arg) => !directoryOptionPattern.test(arg.text))
  const [target] = operands
  const isUnknownTarget = !target || target.dynamic || target.text === '-' || target.text.startsWith('~') || stackRotationPattern.test(target.text)

  if (name === 'popd') {
    const [last] = state.stack.slice(-1)
    state.stack = state.stack.slice(0, -1)
    state.directory = !target && last ? last : { path: state.directory.path, dynamic: true }

    return
  }

  if (isUnknownTarget) {
    state.directory = { path: state.directory.path, dynamic: true }

    return
  }

  if (name === 'pushd') state.stack = [...state.stack, state.directory]
  moveTo(state, target.text)
}

// Points a body file at what the script wrote there, or at run time when that is unknown.
export const settleSource = (source: BodySource, state: ScriptState): BodySource => {
  if (!Object.hasOwn(fileKinds, source.kind)) return source

  const isRelative = !isAbsolute(source.value)
  const path = isRelative && state.directory.path ? join(state.directory.path, source.value) : source.value
  const runtime: BodySource = { kind: 'runtime', value: path, flag: source.flag, dynamic: true }
  if ((isRelative && state.directory.dynamic) || state.unknownWrite) return runtime

  const written = state.writes.get(resolve(state.cwd, path))
  if (!written) return { ...source, value: path }
  if (written.runtime) return runtime

  return { kind: fileKinds[source.kind], value: written.text, flag: source.flag, dynamic: false }
}
