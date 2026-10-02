import type { TableRow } from '../utils/table.utils.ts'
import { normalizeColor } from './zed.ts'

// The label a character carries when no scoped rule colors it.
export const DEFAULT_LABEL = 'default'

// A run of whitespace, which separates the scopes in a grammar name and the parts of a selector.
export const whitespacePattern = /\s+/

export type ThemeRule = {
  scope?: string | string[]
  settings: { foreground?: string }
}

export type Selector = {
  rule: number
  selector: string
  color: string
}

export type TaggedTheme = {
  fg: string
  rules: ThemeRule[]
  labels: Record<string, string>
}

export type ColoredToken = {
  content: string
  offset: number
  color?: string
}

export type ChangeInput = {
  code: string
  before: readonly string[]
  after: readonly string[]
}

export type WinInput = {
  code: string
  winners: readonly string[]
  label: string
}

export type FallbackInput = {
  code: string
  winners: readonly string[]
  fallback: readonly string[]
  label: string
}

export type Candidate = {
  selector: string
  color: string
  wins: number
  fallback: readonly string[]
  emitted: boolean
}

// A rule's selectors, where a string scope may list several separated by commas as TextMate allows.
const selectorsOf = (rule: ThemeRule): string[] => {
  if (rule.scope === undefined) return []
  if (typeof rule.scope === 'string') return rule.scope.split(',').map((selector) => selector.trim())

  return [...rule.scope]
}

// Lists every selector that sets a color with the rule it sits in, leaving out the unscoped default rule.
// A rule setting only a style, such as italic, colors nothing, so it can neither win a character nor lose one.
export const listSelectors = (rules: readonly ThemeRule[]): Selector[] => {
  return rules.flatMap((rule, index) => {
    const { foreground } = rule.settings
    if (!foreground) return []

    return selectorsOf(rule).map((selector) => ({ rule: index, selector, color: normalizeColor(foreground) }))
  })
}

// Copies the rules without one selector, dropping its rule once the rule has no selector left.
export const removeSelector = (rules: readonly ThemeRule[], target: Selector): ThemeRule[] => {
  const kept: ThemeRule[] = []

  rules.forEach((rule, index) => {
    if (index !== target.rule) {
      kept.push(rule)
      return
    }

    const scope = selectorsOf(rule).filter((selector) => selector !== target.selector)
    if (scope.length) kept.push({ scope, settings: rule.settings })
  })

  return kept
}

export const removeRule = (rules: readonly ThemeRule[], index: number): ThemeRule[] => rules.filter((_, position) => position !== index)

// Gives each selector that sets a color its own rule and color, so a character's color names its winner.
// Order is kept, since TextMate ranks rules by specificity and uses position only to break exact ties.
export const tagRules = (rules: readonly ThemeRule[]): TaggedTheme => {
  const labels: Record<string, string> = {}
  const tagged: ThemeRule[] = []
  let fg = ''

  const sentinel = (label: string): string => {
    const color = `#${(Object.keys(labels).length + 1).toString(16).padStart(6, '0')}`
    labels[color] = label

    return color
  }

  for (const rule of rules) {
    if (rule.scope === undefined) {
      fg = sentinel(DEFAULT_LABEL)
      tagged.push({ settings: { foreground: fg } })
      continue
    }

    if (!rule.settings.foreground) continue
    for (const selector of selectorsOf(rule)) tagged.push({ scope: [selector], settings: { foreground: sentinel(selector) } })
  }

  if (!fg) {
    fg = sentinel(DEFAULT_LABEL)
    tagged.unshift({ settings: { foreground: fg } })
  }

  return { fg, rules: tagged, labels }
}

// Spreads Shiki's tokens over the characters they cover, leaving newlines, which no token covers, empty.
export const toCharacters = (lines: readonly (readonly ColoredToken[])[], length: number): string[] => {
  const characters: string[] = new Array(length).fill('')

  for (const token of lines.flat()) {
    const color = normalizeColor(token.color ?? '')
    for (let position = token.offset; position < token.offset + token.content.length; position++) characters[position] = color
  }

  return characters
}

// Reads each character's sentinel color back as the label of the selector that won it.
export const labelCharacters = (characters: readonly string[], labels: Record<string, string>): string[] => characters.map((color) => labels[color] ?? '-')

// Counts the visible characters whose color differs between two runs over the same code.
export const countChanged = (input: ChangeInput): number => {
  const { code, before, after } = input

  let changed = 0
  for (let position = 0; position < code.length; position++) if (code.charAt(position).trim() && before.at(position) !== after.at(position)) changed++

  return changed
}

// Counts the visible characters a selector wins.
export const countWins = (input: WinInput): number => {
  const { code, winners, label } = input

  let wins = 0
  for (let position = 0; position < code.length; position++) if (code.charAt(position).trim() && winners.at(position) === label) wins++

  return wins
}

// Lists the selectors that win the characters a removed selector used to win.
export const fallbacksFor = (input: FallbackInput): string[] => {
  const { code, winners, fallback, label } = input

  const found = new Set<string>()
  for (let position = 0; position < code.length; position++) {
    const replacement = fallback.at(position)
    if (code.charAt(position).trim() && winners.at(position) === label && replacement) found.add(replacement)
  }

  return [...found].sort()
}

// Collects every scope a grammar can emit, from its `scopeName` and each rule's `name` and `contentName`.
// A grammar's own `name` is its language id, such as `typescript`, rather than a scope.
export const collectScopes = (grammar: unknown): Set<string> => {
  const scopes = new Set<string>()

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }

    if (!node || typeof node !== 'object') return

    const isGrammar = 'scopeName' in node
    for (const [key, value] of Object.entries(node)) {
      const isScope = key === 'scopeName' || key === 'contentName' || (key === 'name' && !isGrammar)
      if (isScope && typeof value === 'string') {
        for (const scope of value.split(whitespacePattern)) if (scope) scopes.add(scope)
      }

      walk(value)
    }
  }

  walk(grammar)

  return scopes
}

// Says whether any emitted scope falls under the selector's innermost part, the part a scope must match.
// A segment holding `$`, as in `logical.$1.media`, takes captured text and so matches any part.
export const isEmitted = (selector: string, scopes: ReadonlySet<string>): boolean => {
  const [last = ''] = selector.split(whitespacePattern).filter((part) => part !== '>').slice(-1)
  const parts = last.split('.')
  return [...scopes].some((scope) => {
    const segments = scope.split('.')
    if (segments.length < parts.length) return false

    return parts.every((part, index) => {
      const segment = segments.at(index) ?? ''
      return segment === part || segment.includes('$')
    })
  })
}

// Names why each candidate's removal changed nothing, from dead for any input to silent on these samples.
export const candidateRows = (candidates: readonly Candidate[]): TableRow[] => {
  return candidates.map((candidate) => {
    // A scope no grammar emits is dead for any input, which outranks anything the samples show.
    let reason = 'emitted by no grammar'

    // A selector winning nothing may still win code the samples lack.
    if (candidate.emitted && !candidate.wins) reason = 'wins no sample character'

    // A selector winning characters that keep their color is shadowed on the samples alone.
    if (candidate.emitted && candidate.wins) reason = 'shadowed by a same-color selector'

    return {
      selector: candidate.selector,
      color: candidate.color,
      reason,
      wins: candidate.wins,
      fallback: candidate.fallback.join(' ') || '-',
    }
  })
}

// Names each rule whose removal as a whole changed nothing by its selectors and color.
// Lists each rule of two or more selectors whose every selector changed nothing when removed alone.
export const wholeRuleCandidates = (selectors: readonly Selector[], candidates: readonly Candidate[]): number[] => {
  const rules = [...new Set(selectors.map((selector) => selector.rule))]

  return rules.filter((rule) => {
    const members = selectors.filter((selector) => selector.rule === rule)
    return members.length > 1 && members.every((member) => candidates.some((candidate) => candidate.selector === member.selector))
  })
}

export const wholeRuleRows = (selectors: readonly Selector[], rules: readonly number[]): TableRow[] => {
  return rules.flatMap((rule) => {
    const members = selectors.filter((selector) => selector.rule === rule)
    const [first] = members
    if (!first) return []

    return [{ selectors: members.map((member) => member.selector).join(', '), color: first.color }]
  })
}
