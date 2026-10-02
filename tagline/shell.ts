// A word as the shell would pass it, `dynamic` when an expansion fills part of it at run time.
export type Word = {
  text: string
  dynamic: boolean
}

export type Heredoc = {
  body: string
  quoted: boolean
}

export type Redirect = {
  operator: string
  target: Word
}

// A simple command, with `upstream` holding the command piped into it, if any.
export type ShellCommand = {
  words: Word[]
  source: string
  heredocs: Heredoc[]
  redirects: Redirect[]
  upstream: ShellCommand[]
}

type PendingHeredoc = {
  tag: string
  quoted: boolean
  stripTabs: boolean
  target: Heredoc[]
}

type Scan = {
  commands: ShellCommand[]
  end: number
}

// A redirection operator at the start of the text, longest spelling first.
export const redirectPattern = /^(<<<|<<-|<<|<>|<&|<|>>|>&|>\||>)/

// A parameter name after `$`, or one of the single-character special parameters.
export const parameterPattern = /^([A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/

// A word of digits alone, which before a redirection names a file descriptor.
export const descriptorPattern = /^\d+$/

// The tabs a `<<-` heredoc strips from the start of each line.
export const leadingTabsPattern = /^\t+/

// A `$` or backtick, which an unquoted heredoc expands at run time.
export const expansionPattern = /[$`]/

const ansiEscapes: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' }

// Lists every simple command in a script, nested ones included, in the order each one ends.
export const parseScript = (script: string): ShellCommand[] => {
  const all: ShellCommand[] = []

  const scanList = (start: number, closer: string): Scan => {
    const commands: ShellCommand[] = []
    let words: Word[] = []
    let heredocs: Heredoc[] = []
    let redirects: Redirect[] = []
    let upstream: ShellCommand[] = []
    let pending: PendingHeredoc[] = []
    let commandStart = start
    let text = ''
    let dynamic = false
    let quoted = false
    let started = false
    let redirectOperator = ''
    let awaitingTag = false
    let tagStripTabs = false
    let index = start

    const endWord = (): void => {
      if (!started) return

      if (awaitingTag) {
        pending.push({ tag: text, quoted, stripTabs: tagStripTabs, target: heredocs })
        awaitingTag = false
      } else if (redirectOperator) {
        redirects.push({ operator: redirectOperator, target: { text, dynamic } })
        redirectOperator = ''
      } else {
        words.push({ text, dynamic })
      }

      text = ''
      dynamic = false
      quoted = false
      started = false
    }

    // Ends the current command, returning it in a list that is empty when it held no words.
    const endCommand = (end: number): ShellCommand[] => {
      endWord()
      const ended: ShellCommand[] = []

      if (words.length > 0) {
        const command = { words, source: script.slice(commandStart, end).trim(), heredocs, redirects, upstream }
        commands.push(command)
        all.push(command)
        ended.push(command)
      }

      words = []
      heredocs = []
      redirects = []
      upstream = []
      redirectOperator = ''

      return ended
    }

    // Reads each pending heredoc body from `from`, returning where the command line resumes.
    const readHeredocs = (from: number): number => {
      let position = from

      for (const heredoc of pending) {
        const lines: string[] = []
        let finished = false

        while (!finished && position < script.length) {
          const lineEnd = script.indexOf('\n', position)
          const stop = lineEnd === -1 ? script.length : lineEnd
          const raw = script.slice(position, stop)
          const line = heredoc.stripTabs ? raw.replace(leadingTabsPattern, '') : raw
          const afterTag = line.trimStart().slice(heredoc.tag.length)
          const closesSubstitution = closer !== '' && line.trimStart().startsWith(heredoc.tag) && afterTag.trimStart().startsWith(closer)

          if (line.trim() === heredoc.tag) {
            position = lineEnd === -1 ? script.length : stop + 1
            finished = true
          } else if (closesSubstitution) {
            position = stop - afterTag.trimStart().length
            finished = true
          } else {
            lines.push(line)
            position = lineEnd === -1 ? script.length : stop + 1
          }
        }

        heredoc.target.push({ body: lines.join('\n'), quoted: heredoc.quoted })
      }

      pending = []

      return position
    }

    const scanSubstitution = (at: number): number => {
      const inner = scanList(at + 2, ')')
      const [only, ...others] = inner.commands
      const [heredoc, ...moreHeredocs] = only ? only.heredocs : []
      const [executable, ...args] = only ? only.words : []
      const isCatHeredoc = others.length === 0 && args.length === 0 && moreHeredocs.length === 0 && executable !== undefined && executable.text === 'cat'

      if (isCatHeredoc && heredoc) {
        text += heredoc.body
        if (!heredoc.quoted && expansionPattern.test(heredoc.body)) dynamic = true

        return inner.end
      }

      text += script.slice(at, inner.end)
      dynamic = true

      return inner.end
    }

    const scanAnsi = (at: number): number => {
      let position = at

      while (position < script.length && script[position] !== "'") {
        const char = script[position] ?? ''
        const following = script[position + 1] ?? ''

        if (char === '\\' && following) {
          text += Object.hasOwn(ansiEscapes, following) ? ansiEscapes[following] : char + following
          position += 2
          continue
        }

        text += char
        position += 1
      }

      return position + 1
    }

    const scanDollar = (at: number, inDouble: boolean): number => {
      started = true
      const following = script[at + 1] ?? ''

      if (following === '(') return scanSubstitution(at)

      if (following === '{') {
        const close = script.indexOf('}', at + 2)
        const stop = close === -1 ? script.length : close + 1
        text += script.slice(at, stop)
        dynamic = true

        return stop
      }

      if (following === "'" && !inDouble) {
        quoted = true

        return scanAnsi(at + 2)
      }

      if (following === '"' && !inDouble) return scanDouble(at + 2)

      const [name = ''] = script.slice(at + 1).match(parameterPattern) ?? []
      if (!name) {
        text += '$'

        return at + 1
      }

      text += `$${name}`
      dynamic = true

      return at + 1 + name.length
    }

    const scanBacktick = (at: number): number => {
      const inner = scanList(at + 1, '`')
      text += script.slice(at, inner.end)
      dynamic = true
      started = true

      return inner.end
    }

    const scanDouble = (at: number): number => {
      started = true
      quoted = true
      let position = at

      while (position < script.length) {
        const char = script[position] ?? ''
        const following = script[position + 1] ?? ''

        if (char === '"') return position + 1

        if (char === '\\') {
          if (following === '\n') {
            position += 2
            continue
          }

          const isEscapable = following !== '' && '$`"\\'.includes(following)
          text += isEscapable ? following : char
          position += isEscapable ? 2 : 1
          continue
        }

        if (char === '$') {
          position = scanDollar(position, true)
          continue
        }

        if (char === '`') {
          position = scanBacktick(position)
          continue
        }

        text += char
        position += 1
      }

      return position
    }

    const scanRedirect = (at: number): number => {
      const isDescriptor = started && !quoted && !dynamic && descriptorPattern.test(text)
      if (isDescriptor) {
        text = ''
        started = false
      }

      endWord()
      const [operator = '>'] = script.slice(at).match(redirectPattern) ?? []
      const after = at + operator.length

      if (operator === '<<' || operator === '<<-') {
        awaitingTag = true
        tagStripTabs = operator === '<<-'

        return after
      }

      // A `(` here opens a process substitution, which is scanned rather than read as a target.
      if (script[after] !== '(') redirectOperator = operator

      return after
    }

    while (index < script.length) {
      const char = script[index] ?? ''
      const next = script[index + 1] ?? ''

      if (closer !== '' && char === closer) {
        endCommand(index)

        return { commands, end: index + 1 }
      }

      if (char === '\\') {
        if (next === '\n') {
          index += 2
          continue
        }

        text += next
        started = true
        quoted = true
        index += 2
        continue
      }

      if (char === "'") {
        const close = script.indexOf("'", index + 1)
        const stop = close === -1 ? script.length : close
        text += script.slice(index + 1, stop)
        started = true
        quoted = true
        index = stop + 1
        continue
      }

      if (char === '"') {
        index = scanDouble(index + 1)
        continue
      }

      if (char === '$') {
        index = scanDollar(index, false)
        continue
      }

      if (char === '`') {
        index = scanBacktick(index)
        continue
      }

      if (char === ' ' || char === '\t') {
        endWord()
        index += 1
        continue
      }

      if (char === '\n') {
        endWord()
        const resume = pending.length > 0 ? readHeredocs(index + 1) : index + 1
        endCommand(index)
        index = resume
        commandStart = index
        continue
      }

      if (char === ';' || char === '|') {
        const ended = endCommand(index)
        const isDouble = next === char || (char === '|' && next === '&') || (char === ';' && next === '&')
        if (char === '|' && next !== '|') upstream = ended
        index += isDouble ? 2 : 1
        commandStart = index
        continue
      }

      if (char === '&') {
        if (next === '>') {
          endWord()
          const isAppend = script[index + 2] === '>'
          redirectOperator = isAppend ? '&>>' : '&>'
          index += isAppend ? 3 : 2
          continue
        }

        endCommand(index)
        index += next === '&' ? 2 : 1
        commandStart = index
        continue
      }

      if (char === '(') {
        endWord()
        index = scanList(index + 1, ')').end
        continue
      }

      if (char === ')') {
        endCommand(index)
        index += 1
        commandStart = index
        continue
      }

      if (char === '<' || char === '>') {
        index = scanRedirect(index)
        continue
      }

      if (char === '#' && !started) {
        const lineEnd = script.indexOf('\n', index)
        index = lineEnd === -1 ? script.length : lineEnd
        continue
      }

      text += char
      started = true
      index += 1
    }

    endCommand(index)

    return { commands, end: script.length }
  }

  scanList(0, '')

  return all
}
