import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { parse } from './parse.ts'
import { formatHeading, formatSection, formatSectionAt, formatSections } from './print.ts'

const RAW = 'Notes up top.\n\n## a\n\n- [ ] one\n\n## b\n\n- [x] *two*\n'

describe('All Todo Print Tests', () => {
  describe('formatSections', () => {
    it('gives the whole file as written, without its trailing newline', () => {
      // Act & Assert
      assertEquals(formatSections(RAW, parse(RAW)), 'Notes up top.\n\n## a\n\n- [ ] one\n\n## b\n\n- [x] *two*')
    })

    it('gives (no items) for a file with no sections', () => {
      // Act & Assert
      assertEquals(formatSections('', []), '(no items)')
    })
  })

  describe('formatSection', () => {
    it('gives the one section it is handed', () => {
      // Arrange
      const [section] = parse(RAW)

      // Act & Assert
      assertEquals(formatSection(RAW, section), '## a\n\n- [ ] one')
    })
  })

  describe('formatSectionAt', () => {
    it('gives the section at a position in the file', () => {
      // Act & Assert
      assertEquals(formatSectionAt(RAW, 1), '## b\n\n- [x] *two*')
    })
  })

  describe('formatHeading', () => {
    it('gives a section heading alone', () => {
      // Arrange
      const [section] = parse(RAW)

      // Act & Assert
      assertEquals(formatHeading(RAW, section), '## a')
    })
  })
})
