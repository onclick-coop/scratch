import { basename, skipOptions, stripPrefixes } from './command.ts'
import { parseScript, type Word } from './shell.ts'
import { changeDirectory, createState, recordWrites, type ScriptState, settleSource } from './writes.ts'

// A REST path naming an issue, pull request, release, or commit comment endpoint under a repo.
export const issueEndpointPattern = /repos\/.+\/(issues|pulls|releases|comments|commits\/[^/\s]+\/comments)(\/|$)/

// A GraphQL document holding a mutation that passes a `body` argument.
export const graphqlBodyMutationPattern = /\bmutation\b[\s\S]*\bbody\s*:/

// A short option cluster for a shell that includes `-c`, so the next operand is a script.
export const shellCommandFlagPattern = /^-[A-Za-z]*c[A-Za-z]*$/

// A blank line, of whitespace at most, closing the text that sits before the tagline.
export const taglineSeparatorPattern = /\n[ \t]*\r?\n$/

// A body argument, whose `value` is the text for inline and written kinds and the path otherwise.
export type BodySource = {
  kind: 'inline' | 'file' | 'json-file' | 'graphql' | 'graphql-file' | 'stdin' | 'runtime' | 'written' | 'written-json' | 'written-graphql'
  value: string
  flag: string
  dynamic: boolean
}

export type Finding = {
  segment: string
  subcommand: string
  sources: BodySource[]
}

type CommandSpec = {
  inline: readonly string[]
  file: readonly string[]
  booleans: string
  values: string
}

type ApiField = {
  flag: string
  raw: boolean
  name: string
  value: Word
}

type Subcommand = {
  words: string[]
  rest: Word[]
}

const NO_WORD: Word = { text: '', dynamic: false }

const shells: readonly string[] = ['bash', 'sh', 'zsh', 'dash', 'ksh']

const directoryCommands: readonly string[] = ['cd', 'pushd', 'popd']

// The xargs options that read the next word as their value.
const xargsValueFlags: readonly string[] = ['-a', '-d', '-E', '-I', '-L', '-n', '-P', '-s', '--arg-file', '--delimiter', '--eof', '--max-args', '--max-chars', '--max-lines', '--max-procs', '--process-slot-var']

// gh options that take a value and may come before the subcommand.
const globalValueFlags: readonly string[] = ['-R', '--repo', '--hostname']

// The long `gh api` options that read the next word as their value.
const apiValueFlags: readonly string[] = ['--method', '--field', '--raw-field', '--input', '--header', '--preview', '--jq', '--template', '--cache', '--hostname']

const issueBody = { inline: ['--body', '-b'], file: ['--body-file', '-F'] }
const comment = { inline: ['--comment', '-c'], file: [] }
const notes = { inline: ['--notes', '-n'], file: ['--notes-file', '-F'] }

// Each prose-writing subcommand, with its body flags and the short flags that may share a cluster.
const commandSpecs: Record<string, CommandSpec> = {
  'issue create': { ...issueBody, booleans: 'ew', values: 'almpTtR' },
  'issue new': { ...issueBody, booleans: 'ew', values: 'almpTtR' },
  'issue edit': { ...issueBody, booleans: '', values: 'mtR' },
  'issue comment': { ...issueBody, booleans: 'ew', values: 'R' },
  'issue close': { ...comment, booleans: '', values: 'rR' },
  'issue reopen': { ...comment, booleans: '', values: 'R' },
  'pr create': { ...issueBody, booleans: 'defw', values: 'aBHlmprTtR' },
  'pr new': { ...issueBody, booleans: 'defw', values: 'aBHlmprTtR' },
  'pr edit': { ...issueBody, booleans: '', values: 'BmtR' },
  'pr comment': { ...issueBody, booleans: 'ew', values: 'R' },
  'pr close': { ...comment, booleans: 'd', values: 'R' },
  'pr reopen': { ...comment, booleans: '', values: 'R' },
  'pr review': { ...issueBody, booleans: 'acr', values: 'R' },
  'release create': { ...notes, booleans: 'dp', values: 'tR' },
  'release edit': { ...notes, booleans: '', values: 'tR' },
}

const shellScript = (args: Word[]): string => {
  let readsScript = false
  let index = 0

  while (index < args.length) {
    const [word] = args.slice(index)
    if (!word) break

    const { text } = word
    const isOption = (text.startsWith('-') || text.startsWith('+')) && text !== '--'

    if (!isOption && text !== '--') return readsScript ? text : ''

    if (shellCommandFlagPattern.test(text)) readsScript = true
    const takesValue = isOption && !text.startsWith('--') && (text.endsWith('o') || text.endsWith('O'))
    index += takesValue ? 2 : 1
  }

  return ''
}

const toSource = (kind: 'inline' | 'file', flag: string, value: Word): BodySource => {
  if (value.text === '-') return { kind: 'stdin', value: '-', flag, dynamic: false }
  if (kind === 'file' && value.dynamic) return { kind: 'runtime', value: value.text, flag, dynamic: true }

  return { kind, value: value.text, flag, dynamic: value.dynamic }
}

const kindOf = (spec: CommandSpec, flag: string): 'inline' | 'file' | '' => {
  if (spec.inline.includes(flag)) return 'inline'
  if (spec.file.includes(flag)) return 'file'

  return ''
}

// Reads the body-carrying flags of one gh command in every spelling gh accepts.
const readFlags = (args: Word[], spec: CommandSpec): BodySource[] => {
  const sources: BodySource[] = []
  let index = 0

  while (index < args.length) {
    const [word, next = NO_WORD] = args.slice(index)
    if (!word || word.text === '--') break

    const { text } = word

    if (text.startsWith('--')) {
      const separator = text.indexOf('=')
      const flag = separator === -1 ? text : text.slice(0, separator)
      const kind = kindOf(spec, flag)

      if (kind && separator !== -1) sources.push(toSource(kind, flag, { text: text.slice(separator + 1), dynamic: word.dynamic }))
      if (kind && separator === -1) sources.push(toSource(kind, flag, next))

      index += kind && separator === -1 ? 2 : 1
      continue
    }

    if (!text.startsWith('-') || text === '-') {
      index += 1
      continue
    }

    let consumed = 1

    for (let position = 1; position < text.length; position += 1) {
      const letter = text.charAt(position)
      const rest = text.slice(position + 1)
      const kind = kindOf(spec, `-${letter}`)

      if (kind) {
        sources.push(toSource(kind, `-${letter}`, rest ? { text: rest, dynamic: word.dynamic } : next))
        if (!rest) consumed = 2
        break
      }

      if (spec.values.includes(letter)) {
        if (!rest) consumed = 2
        break
      }

      if (!spec.booleans.includes(letter)) break
    }

    index += consumed
  }

  return sources
}

const splitField = (flag: string, raw: boolean, word: Word): ApiField => {
  const separator = word.text.indexOf('=')
  if (separator === -1) return { flag, raw, name: word.text, value: NO_WORD }

  return { flag, raw, name: word.text.slice(0, separator), value: { text: word.text.slice(separator + 1), dynamic: word.dynamic } }
}

const fileSource = (flag: string, path: Word, kind: 'file' | 'json-file' | 'graphql-file'): BodySource => {
  if (path.text === '-') return { kind: 'stdin', value: '-', flag, dynamic: false }
  if (path.dynamic) return { kind: 'runtime', value: path.text, flag, dynamic: true }

  return { kind, value: path.text, flag, dynamic: false }
}

// Reads a `gh api` call for a body sent to an issue or comment, or a GraphQL mutation.
const readApi = (args: Word[], segment: string): Finding[] => {
  let method = ''
  let endpoint = ''
  const fields: ApiField[] = []
  const inputs: Word[] = []
  let index = 0

  while (index < args.length) {
    const [word, next = NO_WORD] = args.slice(index)
    if (!word || word.text === '--') break

    const { text } = word

    if (text.startsWith('--')) {
      const separator = text.indexOf('=')
      const flag = separator === -1 ? text : text.slice(0, separator)
      const value = separator === -1 ? next : { text: text.slice(separator + 1), dynamic: word.dynamic }
      const takesValue = apiValueFlags.includes(flag)

      if (flag === '--method') method = value.text
      if (flag === '--field' || flag === '--raw-field') fields.push(splitField(flag, flag === '--raw-field', value))
      if (flag === '--input') inputs.push(value)

      index += takesValue && separator === -1 ? 2 : 1
      continue
    }

    if (!text.startsWith('-') || text === '-') {
      if (!endpoint) endpoint = text
      index += 1
      continue
    }

    let consumed = 1

    for (let position = 1; position < text.length; position += 1) {
      const letter = text.charAt(position)
      const rest = text.slice(position + 1)
      const value = rest ? { text: rest, dynamic: word.dynamic } : next

      if ('XfFHpqt'.includes(letter)) {
        if (letter === 'X') method = value.text
        if (letter === 'f' || letter === 'F') fields.push(splitField(`-${letter}`, letter === 'f', value))
        if (!rest) consumed = 2
        break
      }

      if (letter !== 'i') break
    }

    index += consumed
  }

  const sources: BodySource[] = []

  if (endpoint === 'graphql') {
    for (const field of fields) {
      if (field.name !== 'query') continue

      if (!field.raw && field.value.text.startsWith('@')) {
        sources.push(fileSource(`${field.flag} query`, { text: field.value.text.slice(1), dynamic: field.value.dynamic }, 'graphql-file'))
        continue
      }

      if (field.value.dynamic) {
        sources.push({ kind: 'runtime', value: field.value.text, flag: `${field.flag} query`, dynamic: true })
        continue
      }

      if (graphqlBodyMutationPattern.test(field.value.text)) {
        sources.push({ kind: 'graphql', value: field.value.text, flag: `${field.flag} query`, dynamic: false })
      }
    }

    for (const input of inputs) sources.push(fileSource('--input', input, 'graphql-file'))

    return sources.length > 0 ? [{ segment, subcommand: 'api graphql', sources }] : []
  }

  if (!issueEndpointPattern.test(endpoint)) return []

  // gh sends fields or an input file as a POST unless the call names another method.
  const sendsData = fields.length > 0 || inputs.length > 0
  const effectiveMethod = method || (sendsData ? 'POST' : 'GET')
  if (effectiveMethod.toUpperCase() === 'GET') return []

  for (const field of fields) {
    if (field.name !== 'body') continue

    const flag = `${field.flag} body`

    if (!field.raw && field.value.text.startsWith('@')) {
      sources.push(fileSource(flag, { text: field.value.text.slice(1), dynamic: field.value.dynamic }, 'file'))
      continue
    }

    sources.push({ kind: 'inline', value: field.value.text, flag, dynamic: field.value.dynamic })
  }

  for (const input of inputs) sources.push(fileSource('--input', input, 'json-file'))

  return sources.length > 0 ? [{ segment, subcommand: 'api', sources }] : []
}

// Reads gh's subcommand words past its global options, keeping what follows `api`.
const readSubcommand = (args: Word[]): Subcommand => {
  const words: string[] = []
  let index = 0

  while (index < args.length && words.length < 2) {
    const [word] = args.slice(index)
    if (!word) break

    if (word.text.startsWith('-')) {
      index += globalValueFlags.includes(word.text) ? 2 : 1
      continue
    }

    words.push(word.text)
    index += 1
    if (word.text === 'api') break
  }

  return { words, rest: args.slice(index) }
}

const readGh = (args: Word[], segment: string): Finding[] => {
  const { words, rest } = readSubcommand(args)
  const [group] = words
  if (group === 'api') return readApi(rest, segment)

  const subcommand = words.join(' ')
  if (!Object.hasOwn(commandSpecs, subcommand)) return []

  const sources = readFlags(args, commandSpecs[subcommand])

  return sources.length > 0 ? [{ segment, subcommand, sources }] : []
}

// The text xargs replaces with each input line, set by -I, -i, or --replace.
const replaceString = (args: Word[]): string => {
  let index = 0

  while (index < args.length) {
    const [word, next = NO_WORD] = args.slice(index)
    if (!word || word.text === '--' || !word.text.startsWith('-')) break

    const { text } = word
    if (text === '-I') return next.text
    if (text === '-i' || text === '--replace') return '{}'
    if (text.startsWith('-I') || text.startsWith('-i')) return text.slice(2)
    if (text.startsWith('--replace=')) return text.slice('--replace='.length)

    index += xargsValueFlags.includes(text) ? 2 : 1
  }

  return ''
}

// Reads gh run by xargs, checking its fixed arguments, since its input may carry the body.
const readXargs = (args: Word[], segment: string): Finding[] => {
  const replace = replaceString(args)
  const [executable, ...rest] = stripPrefixes(skipOptions(args, xargsValueFlags))
  if (!executable || basename(executable.text) !== 'gh') return []

  const fixed = replace ? rest.map((word) => (word.text.includes(replace) ? { text: word.text, dynamic: true } : word)) : rest
  const findings = readGh(fixed, segment)
  if (findings.length > 0) return findings

  const { words } = readSubcommand(fixed)
  const [first, second] = words
  const mayTakeBody = !first || first === 'api' || !second || Object.hasOwn(commandSpecs, `${first} ${second}`)
  if (!mayTakeBody) return []

  return [{ segment, subcommand: [...words, 'through xargs'].join(' '), sources: [{ kind: 'runtime', value: '', flag: 'xargs', dynamic: true }] }]
}

const scanScript = (script: string, state: ScriptState): Finding[] => {
  const findings: Finding[] = []

  for (const command of parseScript(script)) {
    recordWrites(command, state)

    const [executable, ...args] = stripPrefixes(command.words)
    if (!executable) continue

    const name = basename(executable.text)

    if (directoryCommands.includes(name)) {
      changeDirectory(name, args, state)
      continue
    }

    if (name === 'eval') {
      findings.push(...scanScript(args.map((arg) => arg.text).join(' '), state))
      continue
    }

    if (shells.includes(name)) {
      const inner = shellScript(args)
      if (inner) findings.push(...scanScript(inner, state))
      continue
    }

    const found: Finding[] = []
    if (name === 'xargs') found.push(...readXargs(args, command.source))
    if (name === 'gh') found.push(...readGh(args, command.source))

    for (const finding of found) {
      findings.push({ ...finding, sources: finding.sources.map((source) => settleSource(source, state)) })
    }
  }

  return findings
}

// Finds every gh command a script runs that writes a body, given the directory it starts in.
export const findBodyWrites = (command: string, cwd: string): Finding[] => scanScript(command, createState(cwd))

// A body passes when its last line is the tagline, set off from any text above by a blank line.
export const hasTagline = (body: string, tagline: string): boolean => {
  const trimmed = body.trimEnd()
  if (!trimmed.endsWith(tagline)) return false

  const before = trimmed.slice(0, trimmed.length - tagline.length)

  return before === '' || taglineSeparatorPattern.test(before)
}
