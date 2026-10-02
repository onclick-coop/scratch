import { parseIntegerList } from '../../utils/parse.utils.ts'
import { CliError } from '../../utils/error.utils.ts'
import { setDone } from '../actions.ts'
import { splitSection } from '../args.ts'
import { parse as parseList } from '../parse.ts'
import { formatSectionAt } from '../print.ts'
import type { Outcome } from '../schema.ts'
import { checkIndices, requireSection, requireText } from '../section.ts'

type UncheckArgs = {
  indices: number[]
  section: string | null
}

const parse = (argv: string[]): UncheckArgs => {
  const { words, section } = splitSection(argv)
  const [first, extra] = words
  if (!first) throw new CliError('Missing indices for `uncheck`', ['Example: `uncheck 0,2 in groceries`'])
  if (extra) throw new CliError(`Unexpected argument: "${extra}"`, [`Join indices with commas: \`uncheck ${words.join(',')}\``])

  return { indices: parseIntegerList(first), section }
}

export const runUncheck = (argv: string[], text: string): Outcome => {
  const args = parse(argv)
  const sections = parseList(text)
  const section = requireSection(sections, args.section)

  checkIndices(args.indices, section.items.length)
  requireText(section, args.indices, 'uncheck')
  const next = setDone(text, section.items.filter((_, index) => args.indices.includes(index)), false)

  return { text: next, output: formatSectionAt(next, sections.indexOf(section)) }
}
