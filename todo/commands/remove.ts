import { parseIntegerList } from '../../utils/parse.utils.ts'
import { CliError } from '../../utils/error.utils.ts'
import { dropSection, isEmptySection, removeItems } from '../actions.ts'
import { splitSection } from '../args.ts'
import { parse as parseList } from '../parse.ts'
import { formatHeading, formatSectionAt } from '../print.ts'
import type { Outcome } from '../schema.ts'
import { checkIndices, requireSection } from '../section.ts'

type RemoveArgs = {
  indices: number[]
  section: string | null
}

const parse = (argv: string[]): RemoveArgs => {
  const { words, section } = splitSection(argv)
  const [first, extra] = words
  if (!first) throw new CliError('Missing indices for `remove`', ['Example: `remove 0,2 in groceries`'])
  if (extra) throw new CliError(`Unexpected argument: "${extra}"`, [`Join indices with commas: \`remove ${words.join(',')}\``])

  return { indices: parseIntegerList(first), section }
}

export const runRemove = (argv: string[], text: string): Outcome => {
  const args = parse(argv)
  const sections = parseList(text)
  const section = requireSection(sections, args.section)

  checkIndices(args.indices, section.items.length)
  const removed = removeItems(text, section, section.items.filter((_, index) => args.indices.includes(index)))
  const position = sections.indexOf(section)
  const [after] = parseList(removed).slice(position, position + 1)

  // A section left holding only its heading leaves the file, and one with other text stays.
  if (after && isEmptySection(removed, after)) return { text: dropSection(removed, after), output: formatHeading(removed, after) }

  return { text: removed, output: formatSectionAt(removed, position) }
}
