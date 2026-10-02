import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { escapeText, headingLine } from './escape.ts'

describe('All Todo Escape Tests', () => {
  describe('escapeText', () => {
    it('leaves plain text as it is', () => {
      // Act & Assert
      assertEquals(escapeText('buy milk'), 'buy milk')
    })

    it('escapes text that would otherwise read back as markup', () => {
      // Act & Assert
      assertEquals(escapeText('fix *all* the [links]'), 'fix \\*all\\* the \\[links]')
      assertEquals(escapeText('item with `code` and _under_'), 'item with \\`code\\` and \\_under\\_')
    })

    it('escapes a leading run of dashes that would otherwise read as a marker', () => {
      // Act & Assert
      assertEquals(escapeText('-- dashed item'), '\\-- dashed item')
    })

    it('keeps a line break without the indent a list item adds', () => {
      // Act & Assert
      assertEquals(escapeText('two\nlines'), 'two\nlines')
    })
  })

  describe('headingLine', () => {
    it('writes a second-level heading for the name', () => {
      // Act & Assert
      assertEquals(headingLine('groceries'), '## groceries')
    })

    it('escapes a name that would otherwise read back as markup', () => {
      // Act & Assert
      assertEquals(headingLine('fix *all*'), '## fix \\*all\\*')
    })
  })
})
