import { CliError } from '../utils/error.utils.ts'
import type { Section } from './schema.ts'

const existing = (sections: Section[]): string => `Existing sections: ${sections.map((section) => section.name).join(', ')}`

export const hasSection = (sections: Section[], name: string): boolean => sections.some((section) => section.name === name)

// Resolves the named section, or the only one when none is named, refusing a name two share.
export const requireSection = (sections: Section[], name: string | null): Section => {
  if (name) {
    const matches = sections.filter((section) => section.name === name)
    const [match, second] = matches

    if (second) {
      throw new CliError(`Section "${name}" names more than one heading`, [
        `Headings on lines ${matches.map((section) => section.line).join(' and ')} share the name`,
        'Rename one of them by hand',
      ])
    }

    if (match) return match

    throw new CliError(`Section "${name}" not found`, [sections.length > 0 ? existing(sections) : 'No sections exist yet'])
  }

  const [only, second] = sections
  if (only && !second) return only
  if (!only) throw new CliError('The list has no items yet', ['Add one first, as `add buy milk in groceries`'])

  throw new CliError('Multiple sections present; specify one with `in <section>`', [existing(sections)])
}

export const checkIndices = (indices: number[], itemCount: number): void => {
  const outOfRange = indices.filter((i) => i < 0 || i >= itemCount)
  if (outOfRange.length === 0) return

  const range = `Section has ${itemCount} item${itemCount === 1 ? '' : 's'} (indices 0 to ${itemCount - 1})`
  throw new CliError(`Index out of range: ${outOfRange.join(', ')}`, [range])
}

// Refuses to check or edit a bullet that opens with no text, such as a code fence.
export const requireText = (section: Section, indices: number[], verb: string): void => {
  const [blank] = section.items.filter((item, index) => indices.includes(index) && !item.hasText)
  if (!blank) return

  const index = section.items.indexOf(blank)
  throw new CliError(`Item ${index} on line ${blank.line} opens with no text to ${verb}`, [
    `Change it by hand, or remove it with \`remove ${index} in ${section.name}\``,
  ])
}
