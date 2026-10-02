import type { RootContent } from 'mdast'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'

const ITEM_PREFIX = '- [ ] '

const render = (children: RootContent[]): string => {
  return toMarkdown({ type: 'root', children }, {
    bullet: '-',
    extensions: [gfmToMarkdown()],
  })
}

// Turns typed text into item source, escaping anything that would otherwise read back as markup.
export const escapeText = (text: string): string => {
  const markdown = render([{
    type: 'list',
    spread: false,
    children: [{
      type: 'listItem',
      checked: false,
      children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }],
    }],
  }])

  return markdown.slice(ITEM_PREFIX.length, -1).replaceAll('\n  ', '\n')
}

// Writes the heading line for a new section, escaping the name the same way.
export const headingLine = (name: string): string => {
  return render([{ type: 'heading', depth: 2, children: [{ type: 'text', value: name }] }]).slice(0, -1)
}
