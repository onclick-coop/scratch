import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parse } from './parse.ts'
import { checkIndices, hasSection, requireSection, requireText } from './section.ts'

const two = () => parse('## a\n\n- [ ] one\n\n## b\n')

describe('All Todo Section Tests', () => {
  describe('hasSection', () => {
    it('finds a section by its exact name, case included', () => {
      // Act & Assert
      assertEquals(hasSection(two(), 'b'), true)
      assertEquals(hasSection(two(), 'A'), false)
    })
  })

  describe('requireSection', () => {
    it('returns the named section', () => {
      // Act
      const section = requireSection(two(), 'b')

      // Assert
      assertEquals([section.name, section.line], ['b', 5])
    })

    it('resolves the only section when no name is given', () => {
      // Act
      const section = requireSection(parse('## solo\n'), null)

      // Assert
      assertEquals(section.name, 'solo')
    })

    it('refuses a name two headings share, naming both lines', () => {
      // Arrange
      const sections = parse('## a\n\n## b\n\n## a\n')

      // Act
      const error = assertThrows(() => requireSection(sections, 'a'), CliError, 'Section "a" names more than one heading')

      // Assert
      assertEquals(error.suggestions, ['Headings on lines 1 and 5 share the name', 'Rename one of them by hand'])
    })

    it('refuses a name that matches no section, listing the ones that exist', () => {
      // Act
      const error = assertThrows(() => requireSection(two(), 'c'), CliError, 'Section "c" not found')

      // Assert
      assertEquals(error.suggestions, ['Existing sections: a, b'])
    })

    it('says no sections exist when the list is empty', () => {
      // Act
      const error = assertThrows(() => requireSection([], 'c'), CliError, 'Section "c" not found')

      // Assert
      assertEquals(error.suggestions, ['No sections exist yet'])
    })

    it('says the list is empty when no name is given and nothing exists to act on', () => {
      // Act
      const error = assertThrows(() => requireSection([], null), CliError, 'The list has no items yet')

      // Assert
      assertEquals(error.suggestions, ['Add one first, as `add buy milk in groceries`'])
    })

    it('refuses a missing name when several sections exist, listing them', () => {
      // Act
      const error = assertThrows(() => requireSection(two(), null), CliError, 'Multiple sections present')

      // Assert
      assertEquals(error.suggestions, ['Existing sections: a, b'])
    })
  })

  describe('checkIndices', () => {
    it('accepts indices inside the section', () => {
      // Act & Assert
      checkIndices([0, 2], 3)
    })

    it('refuses an index past the end, naming the range', () => {
      // Act
      const error = assertThrows(() => checkIndices([1, 3, 5], 3), CliError, 'Index out of range: 3, 5')

      // Assert
      assertEquals(error.suggestions, ['Section has 3 items (indices 0 to 2)'])
    })

    it('names a single item in the singular', () => {
      // Act
      const error = assertThrows(() => checkIndices([1], 1), CliError, 'Index out of range: 1')

      // Assert
      assertEquals(error.suggestions, ['Section has 1 item (indices 0 to 0)'])
    })
  })

  describe('requireText', () => {
    it('accepts items that open with text', () => {
      // Arrange
      const [section] = parse('## a\n\n-\n- [ ] one\n')

      // Act & Assert
      requireText(section, [1], 'check')
    })

    it('refuses a bullet with no text, naming its index, line, and how to remove it', () => {
      // Arrange
      const [section] = parse('## a\n\n- [ ] one\n- ```\n  code\n  ```\n')

      // Act
      const error = assertThrows(() => requireText(section, [0, 1], 'edit'), CliError, 'Item 1 on line 4 opens with no text')

      // Assert
      assertEquals(error.suggestions, ['Change it by hand, or remove it with `remove 1 in a`'])
    })
  })
})
