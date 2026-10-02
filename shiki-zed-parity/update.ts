import type { TableRow } from '../utils/table.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import type { Mismatch } from './diff.ts'
import { THEME_PATH } from './languages.ts'
import type { Pins } from './pins.ts'

// One palette entry line, such as `  'comment.doc': '#878e98',`, capturing the key and its color.
export const paletteEntryPattern = /^ {2}'?([\w.]+)'?: '(#[0-9a-f]{6})',$/

// A capture name in a query, such as `@punctuation.special`, starting with a letter or underscore.
export const capturePattern = /@([A-Za-z_][\w.]*)/g

// A double-quoted query string, such as `"@media"`, whose contents are text rather than a capture.
export const queryStringPattern = /"(?:[^"\\]|\\.)*"/g

// A query comment running from a semicolon to the end of its line.
export const queryCommentPattern = /;.*$/gm

export type PaletteInput = {
  ours: Record<string, string>
  pinned: Record<string, string>
  current: Record<string, string>
}

export type QueryInput = {
  language: string
  pinned: string
  current: string
}

// Lists the commit the theme links for each source it was matched against.
export const pinRows = (pins: Pins): TableRow[] => {
  return [
    { source: THEME_PATH, commit: pins.theme },
    { source: 'highlights.scm', commit: pins.queries },
  ]
}

// Reads the palette object literal out of the theme source, one entry per line.
export const parsePalette = (source: string): Record<string, string> => {
  const [, block = ''] = source.split('const palette = Object.freeze({')
  const [body = ''] = block.split('})')

  const palette: Record<string, string> = {}
  for (const line of body.split('\n')) {
    const [, key, color] = paletteEntryPattern.exec(line) ?? []
    if (key && color) palette[key] = color
  }

  if (!Object.keys(palette).length) {
    throw new CliError('Found no palette entries in the theme source', ["Keep the theme's `const palette = Object.freeze({` block with one `key: '#rrggbb',` per line"])
  }

  return palette
}

// Lists each palette key whose color differs from the current One Dark, or changed since the pinned one.
export const paletteRows = (input: PaletteInput): TableRow[] => {
  const { ours, pinned, current } = input

  // A key One Dark lacks reads as a dash, never as a property every object inherits, such as `constructor`.
  const colorOf = (palette: Record<string, string>, key: string): string => (Object.hasOwn(palette, key) && palette[key]) || '-'

  const rows: TableRow[] = []
  for (const [key, color] of Object.entries(ours)) {
    const currentColor = colorOf(current, key)
    const pinnedColor = colorOf(pinned, key)
    if (color !== currentColor || pinnedColor !== currentColor) rows.push({ key, ours: color, pinned: pinnedColor, current: currentColor })
  }

  return rows
}

// Lists the distinct capture names a query file assigns, ignoring strings and comments.
export const captureNames = (query: string): string[] => {
  // Strings go first, since a string such as `";"` would otherwise open a comment.
  const code = query.replace(queryStringPattern, '""').replace(queryCommentPattern, '')
  const names = [...code.matchAll(capturePattern)].map(([, name]) => name)
  return [...new Set(names)].sort()
}

// Says whether a language's query changed between the pinned and current checkouts, and which captures came or went.
export const queryRow = (input: QueryInput): TableRow => {
  const { language, pinned, current } = input

  const before = captureNames(pinned)
  const after = captureNames(current)
  const added = after.filter((name) => !before.includes(name))
  const removed = before.filter((name) => !after.includes(name))

  return {
    language,
    query: pinned === current ? 'unchanged' : 'changed',
    added: added.join(' ') || '-',
    removed: removed.join(' ') || '-',
  }
}

// Lists the mismatches the current checkout introduces and the ones it resolves, against the pinned run.
export const changeRows = (pinned: readonly Mismatch[], current: readonly Mismatch[]): TableRow[] => {
  const keyOf = (mismatch: Mismatch): string => JSON.stringify(mismatch)
  const pinnedKeys = new Set(pinned.map(keyOf))
  const currentKeys = new Set(current.map(keyOf))

  const changes = [
    ...current.filter((mismatch) => !pinnedKeys.has(keyOf(mismatch))).map((mismatch) => ({ change: 'new', mismatch })),
    ...pinned.filter((mismatch) => !currentKeys.has(keyOf(mismatch))).map((mismatch) => ({ change: 'resolved', mismatch })),
  ]

  return changes.map(({ change, mismatch }) => ({
    change,
    language: mismatch.language,
    fragment: mismatch.fragment,
    ours: mismatch.ours,
    selector: mismatch.selector,
    zed: mismatch.zed,
    capture: mismatch.capture,
  }))
}
