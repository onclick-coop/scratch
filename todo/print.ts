import { parse } from './parse.ts'
import type { Section } from './schema.ts'

export const formatSections = (text: string, sections: Section[]): string => {
  if (sections.length === 0) return '(no items)'

  return text.trim()
}

export const formatSection = (text: string, section: Section): string => text.slice(section.start, section.end).trim()

// Reads the file back after a change, so the printed section is the one that was written.
export const formatSectionAt = (text: string, position: number): string => {
  const [section] = parse(text).slice(position, position + 1)
  if (!section) return ''

  return formatSection(text, section)
}

// A section a removal dropped prints as its heading alone.
export const formatHeading = (text: string, section: Section): string => text.slice(section.start, section.headingEnd).trim()
