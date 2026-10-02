import { CliError } from '../../utils/error.utils.ts'
import { splitSection } from '../args.ts'
import { parse as parseList } from '../parse.ts'
import { formatSection, formatSections } from '../print.ts'
import type { Outcome } from '../schema.ts'
import { requireSection } from '../section.ts'

type ListArgs = {
  section: string | null
}

const parse = (argv: string[]): ListArgs => {
  const { words, section } = splitSection(argv)
  const [extra] = words
  if (extra) throw new CliError(`Unexpected argument: "${extra}"`, ['Name a section with `list in <section>`'])

  return { section }
}

export const runList = (argv: string[], text: string): Outcome => {
  const args = parse(argv)
  const sections = parseList(text)
  if (args.section) return { text, output: formatSection(text, requireSection(sections, args.section)) }

  return { text, output: formatSections(text, sections) }
}
