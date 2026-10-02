import type { TableRow } from '../utils/table.utils.ts'
import { type CharacterColor, normalizeColor } from './zed.ts'

// The table shows this many of the innermost scopes, where --json carries the whole stack.
const TABLE_SCOPE_DEPTH = 3

// The fields read off Shiki's ThemedToken when codeToTokens runs with includeExplanation.
export type ShikiToken = {
  content: string
  offset: number
  color?: string
  explanation?: { content: string; scopes: { scopeName: string }[] }[]
}

export type Piece = {
  content: string
  offset: number
  color: string
  scopes: string[]
}

export type DiffInput = {
  language: string
  code: string
  pieces: readonly Piece[]
  winners: readonly string[]
  zed: readonly CharacterColor[]
}

export type Mismatch = {
  language: string
  fragment: string
  ours: string
  selector: string
  zed: string
  capture: string
  scopes: string[]
}

// Splits each token into its explained pieces, dropping the root scope every piece shares.
export const toPieces = (lines: readonly (readonly ShikiToken[])[]): Piece[] => {
  const pieces: Piece[] = []

  for (const token of lines.flat()) {
    const color = normalizeColor(token.color ?? '')
    let offset = token.offset

    for (const { content, scopes } of token.explanation ?? [{ content: token.content, scopes: [] }]) {
      pieces.push({ content, offset, color, scopes: scopes.slice(1).map((scope) => scope.scopeName) })
      offset += content.length
    }
  }

  return pieces
}

// Lists each piece whose visible characters Zed colors differently, once per Zed color and scope stack.
// Each names the theme selector that won the piece, which is the rule a fix or a gap comment belongs beside.
export const diffColors = (input: DiffInput): Mismatch[] => {
  const { language, code, pieces, winners, zed } = input

  const seen = new Set<string>()
  const mismatches: Mismatch[] = []

  for (const piece of pieces) {
    const differing = new Map<string, string>()

    for (let position = piece.offset; position < piece.offset + piece.content.length; position++) {
      const character = zed.at(position)
      if (!character || !code.charAt(position).trim() || character.color === piece.color) continue
      differing.set(character.color, character.capture)
    }

    for (const [color, capture] of differing) {
      const selector = winners.at(piece.offset) ?? '-'
      const mismatch = { language, fragment: piece.content, ours: piece.color, selector, zed: color, capture, scopes: piece.scopes }
      const key = JSON.stringify(mismatch)
      if (seen.has(key)) continue
      seen.add(key)
      mismatches.push(mismatch)
    }
  }

  return mismatches
}

export const toRows = (mismatches: readonly Mismatch[]): TableRow[] => {
  return mismatches.map((mismatch) => ({
    language: mismatch.language,
    fragment: mismatch.fragment,
    ours: mismatch.ours,
    selector: mismatch.selector,
    zed: mismatch.zed,
    capture: mismatch.capture,
    scopes: mismatch.scopes.slice(-TABLE_SCOPE_DEPTH).join(' > '),
  }))
}

// Counts the mismatches per language for the summary line, in the order the languages ran.
export const summarize = (languages: readonly string[], mismatches: readonly Mismatch[]): string => {
  const counts = languages.map((language) => `${language} ${mismatches.filter((mismatch) => mismatch.language === language).length}`)
  return `${mismatches.length} mismatches (${counts.join(', ')})`
}
