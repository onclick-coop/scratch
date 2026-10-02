import { escapeText, headingLine } from './escape.ts'
import type { Item, Section } from './schema.ts'

type Splice = {
  start: number
  end: number
  text: string
}

// Applies splices from the end backwards, so each offset still points where it did.
const applySplices = (raw: string, splices: Splice[]): string => {
  const ordered = [...splices].sort((a, b) => b.start - a.start)
  let result = raw

  for (const { start, end, text } of ordered) {
    result = `${result.slice(0, start)}${text}${result.slice(end)}`
  }

  return result
}

const withoutTrailingNewlines = (text: string): string => {
  let end = text.length
  while (end > 0 && text[end - 1] === '\n') end--

  return text.slice(0, end)
}

// Indents the later lines of typed text under the item's marker, so they stay inside the item.
const itemSource = (text: string, indent: number): string => escapeText(text).replaceAll('\n', `\n${' '.repeat(indent)}`)

// Matches the indent, then a bullet or a number and its delimiter, opening a list item's line.
export const listMarkerPattern = /^([ \t]*)(?:([-+*])|(\d{1,9})([.)]))/

// The marker for an item after the one on this line, counting an ordered list's number up.
export const nextMarker = (line: string): string => {
  const match = listMarkerPattern.exec(line)
  if (!match) return '- '

  const [, indent, bullet, number, delimiter] = match
  if (bullet) return `${indent}${bullet} `

  return `${indent}${Number(number) + 1}${delimiter} `
}

// Adds an item after the section's last item, or starts a list at the end of a section with none.
export const addItem = (raw: string, section: Section, text: string): string => {
  const [last] = section.items.slice(-1)

  if (last) {
    const marker = nextMarker(raw.slice(last.start, last.end))
    const lead = raw[last.end - 1] === '\n' ? '' : '\n'
    const line = `${lead}${marker}[ ] ${itemSource(text, marker.length)}\n`

    return applySplices(raw, [{ start: last.end, end: last.end, text: line }])
  }

  const body = raw.slice(section.start, section.end)
  const kept = withoutTrailingNewlines(body)
  const rest = body.slice(kept.length + 1)

  return applySplices(raw, [{ start: section.start, end: section.end, text: `${kept}\n\n- [ ] ${itemSource(text, 2)}\n${rest}` }])
}

// Walks back over the blank lines that end just before an offset at the start of a line.
const blankLinesStart = (raw: string, offset: number): number => {
  let cut = offset

  while (cut > 0) {
    const previous = cut < 2 ? 0 : raw.lastIndexOf('\n', cut - 2) + 1
    if (raw.slice(previous, cut).trim() !== '') break

    cut = previous
  }

  return cut
}

// Appends a new section holding one item, a blank line after whatever the file already ends with.
export const addSection = (raw: string, name: string, text: string): string => {
  const kept = withoutTrailingNewlines(raw)
  const lead = kept ? `${kept}\n\n` : ''

  return `${lead}${headingLine(name)}\n\n- [ ] ${itemSource(text, 2)}\n`
}

// Rewrites only the checkbox character, adding a checkbox to a plain list item that is checked.
export const setDone = (raw: string, items: Item[], done: boolean): string => {
  const splices: Splice[] = []

  for (const item of new Set(items)) {
    if (item.done === done) continue

    if (item.hasBox) {
      splices.push({ start: item.markerEnd + 1, end: item.markerEnd + 2, text: done ? 'x' : ' ' })
      continue
    }

    splices.push({ start: item.textStart, end: item.textStart, text: '[x] ' })
  }

  return applySplices(raw, splices)
}

// Replaces only the item's first paragraph, keeping its checkbox and anything nested under it.
export const editItem = (raw: string, item: Item, text: string): string => {
  return applySplices(raw, [{ start: item.textStart, end: item.textEnd, text: itemSource(text, item.markerEnd - item.start) }])
}

// Removes each item's lines, with the blank lines above a run that ends a list.
export const removeItems = (raw: string, section: Section, items: Item[]): string => {
  const removed = new Set(items)
  const splices: Splice[] = []

  for (const item of removed) {
    let tail = item
    let next = section.items.find((other) => other.start === tail.end)

    while (!tail.isLast && next && removed.has(next)) {
      tail = next
      next = section.items.find((other) => other.start === tail.end)
    }

    // Those blank lines go when a kept item sits above the run or a blank line below it.
    const before = section.items.find((other) => other.end === item.start)
    const [nextLine = ''] = raw.slice(tail.end).split('\n', 1)
    const isRunStart = before === undefined || !removed.has(before)
    const isKeptBefore = before !== undefined && !removed.has(before)
    const isBlankAfter = nextLine.trim() === ''
    const isListTail = isRunStart && tail.isLast && (isKeptBefore || isBlankAfter)
    const start = isListTail ? blankLinesStart(raw, item.start) : item.start

    splices.push({ start, end: item.end, text: '' })
  }

  return applySplices(raw, splices)
}

// A section holding nothing but its heading, once its last item goes.
export const isEmptySection = (raw: string, section: Section): boolean => {
  return section.items.length === 0 && raw.slice(section.headingEnd, section.end).trim() === ''
}

// Drops a section, and when it was the last, the blank line that set it off from the one before.
export const dropSection = (raw: string, section: Section): string => {
  const before = raw.slice(0, section.start)
  const after = raw.slice(section.end)
  if (after) return `${before}${after}`

  const kept = withoutTrailingNewlines(before)

  return kept ? `${kept}\n` : ''
}
