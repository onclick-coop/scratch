import { parseIntegerList } from '../../utils/parse.utils.ts'
import { CliError } from '../../utils/error.utils.ts'
import { setDone } from '../actions.ts'
import { splitSection } from '../args.ts'
import { parse as parseList } from '../parse.ts'
import { formatSectionAt } from '../print.ts'
import type { Outcome } from '../schema.ts'
import { checkIndices, requireSection, requireText } from '../section.ts'

type CheckArgs = {
  indices: number[]
  section: string | null
}

const parse = (argv: string[]): CheckArgs => {
  const { words, section } = splitSection(argv)
  const [first, extra] = words
  if (!first) throw new CliError('Missing indices for `check`', ['Example: `check 0,2 in groceries`'])
  if (extra) throw new CliError(`Unexpected argument: "${extra}"`, [`Join indices with commas: \`check ${words.join(',')}\``])

  return { indices: parseIntegerList(first), section }
}

export const runCheck = (argv: string[], text: string): Outcome => {
  const args = parse(argv)
  const sections = parseList(text)
  const section = requireSection(sections, args.section)

  checkIndices(args.indices, section.items.length)
  requireText(section, args.indices, 'check')
  const next = setDone(text, section.items.filter((_, index) => args.indices.includes(index)), true)

  return { text: next, output: formatSectionAt(next, sections.indexOf(section)) }
}
