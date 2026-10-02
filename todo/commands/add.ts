import { CliError } from '../../utils/error.utils.ts'
import { addItem, addSection } from '../actions.ts'
import { splitSection } from '../args.ts'
import { parse as parseList } from '../parse.ts'
import { formatSectionAt } from '../print.ts'
import type { Outcome } from '../schema.ts'
import { hasSection, requireSection } from '../section.ts'

type AddArgs = {
  content: string
  section: string | null
  sectionWordCount: number
}

const parse = (argv: string[]): AddArgs => {
  const { words, section, sectionWordCount } = splitSection(argv)
  const content = words.join(' ').trim()
  if (!content) throw new CliError('Missing content for `add`', ['Example: `add buy milk in groceries`'])

  return { content, section, sectionWordCount }
}

export const runAdd = (argv: string[], text: string): Outcome => {
  const args = parse(argv)
  const sections = parseList(text)

  if (args.section && !hasSection(sections, args.section)) {
    // Unquoted words after an `in` inside the text would otherwise name a section nobody asked for.
    if (args.sectionWordCount > 1) {
      throw new CliError(`Section "${args.section}" not found`, [
        `Quote the item as one argument to keep \`in\` in its text, as \`add '${args.content} in ${args.section}'\``,
        `Quote a section name of several words to create it, as \`add ${args.content} in '${args.section}'\``,
      ])
    }

    const next = addSection(text, args.section, args.content)

    return { text: next, output: formatSectionAt(next, sections.length) }
  }

  if (!args.section && sections.length === 0) {
    throw new CliError('The list has no sections yet; name one with `in <section>`', ['Example: `add buy milk in groceries`'])
  }

  const section = requireSection(sections, args.section)
  const next = addItem(text, section, args.content)

  return { text: next, output: formatSectionAt(next, sections.indexOf(section)) }
}
