import type { List } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { toString } from 'mdast-util-to-string'
import { gfm } from 'micromark-extension-gfm'
import type { Item, Section } from './schema.ts'

// Matches a line break and the indent of a paragraph's next line, which item content leaves out.
export const continuationIndentPattern = /\n[ \t]+/g

// Matches a task checkbox and the spaces after it, at the end of an item's text prefix.
export const taskBoxPattern = /\[[ xX]\][ \t]*$/

const lineStart = (raw: string, offset: number): number => {
  if (offset === 0) return 0

  return raw.lastIndexOf('\n', offset - 1) + 1
}

const lineEnd = (raw: string, offset: number): number => {
  const at = raw.indexOf('\n', offset)

  return at === -1 ? raw.length : at + 1
}

const lineNumber = (raw: string, offset: number): number => raw.slice(0, offset).split('\n').length

// An item runs from its line to the next item's, taking its nested lists and spacing with it.
// Every bullet counts, so an index reaches the bullet a reader counts to, text or not.
const listItems = (raw: string, list: List): Item[] => {
  const result: Item[] = []

  for (const [index, li] of list.children.entries()) {
    const itemStart = li.position?.start.offset
    const itemEnd = li.position?.end.offset
    if (itemStart === undefined || itemEnd === undefined) continue

    const [next] = list.children.slice(index + 1)
    const nextStart = next?.position?.start.offset
    const start = lineStart(raw, itemStart)
    const end = nextStart === undefined ? lineEnd(raw, itemEnd) : lineStart(raw, nextStart)
    const [first] = li.children
    const firstStart = first?.position?.start.offset ?? itemEnd
    const place = { isLast: nextStart === undefined, line: lineNumber(raw, start), start, end }

    if (!first || first.type !== 'paragraph') {
      result.push({
        ...place,
        content: '',
        done: false,
        hasBox: false,
        hasText: false,
        markerEnd: firstStart,
        textStart: firstStart,
        textEnd: firstStart,
      })
      continue
    }

    // The first child starts past the task marker, where the paragraph itself may start on it.
    const [head] = first.children
    const textStart = head?.position?.start.offset ?? firstStart
    const textEnd = first.position?.end.offset ?? textStart
    const box = typeof li.checked === 'boolean' ? taskBoxPattern.exec(raw.slice(start, textStart)) : null

    result.push({
      ...place,
      content: raw.slice(textStart, textEnd).replaceAll(continuationIndentPattern, '\n'),
      done: li.checked === true,
      hasBox: box !== null,
      hasText: true,
      markerEnd: box ? start + box.index : textStart,
      textStart,
      textEnd,
    })
  }

  return result
}

// Reads where each section and item sits in the file, leaving the text itself untouched.
export const parse = (raw: string): Section[] => {
  const tree = fromMarkdown(raw, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  })

  const sections: Section[] = []

  for (const node of tree.children) {
    const [prev] = sections.slice(-1)

    if (node.type === 'heading' && node.depth === 2) {
      const headingStart = node.position?.start.offset
      const headingEnd = node.position?.end.offset
      if (headingStart === undefined || headingEnd === undefined) continue

      const start = lineStart(raw, headingStart)
      if (prev) prev.end = start

      sections.push({ name: toString(node), line: lineNumber(raw, start), start, headingEnd, end: raw.length, items: [] })
      continue
    }

    if (node.type !== 'list' || !prev) continue

    prev.items.push(...listItems(raw, node))
  }

  return sections
}
