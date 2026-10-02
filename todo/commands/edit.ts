import { parseIntegerList } from '../../utils/parse.utils.ts'
import { CliError } from '../../utils/error.utils.ts'
import { editItem } from '../actions.ts'
import { splitSection } from '../args.ts'
import { parse as parseList } from '../parse.ts'
import { formatSectionAt } from '../print.ts'
import type { Outcome } from '../schema.ts'
import { checkIndices, requireSection, requireText } from '../section.ts'

type EditArgs = {
  index: number
  content: string
  section: string | null
}

const parse = (argv: string[]): EditArgs => {
  const { words, section } = splitSection(argv)
  const [first, ...contentWords] = words
  if (!first) throw new CliError('Missing index for `edit`', ['Example: `edit 0 new text in groceries`'])

  const [index, other] = parseIntegerList(first)
  if (index === undefined || other !== undefined) throw new CliError('`edit` takes exactly one index', ['Example: `edit 0 text`'])

  const content = contentWords.join(' ').trim()
  if (!content) throw new CliError('Missing content for `edit`', ['Example: `edit 0 new text`'])

  return { index, content, section }
}

export const runEdit = (argv: string[], text: string): Outcome => {
  const args = parse(argv)
  const sections = parseList(text)
  const section = requireSection(sections, args.section)

  checkIndices([args.index], section.items.length)
  requireText(section, [args.index], 'edit')
  const [item] = section.items.slice(args.index, args.index + 1)
  if (!item) return { text, output: '' }

  const next = editItem(text, item, args.content)

  return { text: next, output: formatSectionAt(next, sections.indexOf(section)) }
}
