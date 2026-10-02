import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import type { ThemeFamilyOutput } from './schema.ts'
import { colorCharacters, normalizeColor, type SyntaxTheme, toSyntaxTheme } from './zed.ts'

const theme: SyntaxTheme = {
  foreground: '#acb2be',
  colors: { punctuation: '#acb2be', 'punctuation.special': '#b1574b', function: '#73ade9', variable: '#dce0e5' },
}

describe('All Zed Parity Zed Tests', () => {
  describe('normalizeColor', () => {
    it('drops the alpha byte and lower-cases the digits', () => {
      // Act & Assert
      assertEquals(normalizeColor('#74ADE8FF'), '#74ade8')
    })
  })

  describe('toSyntaxTheme', () => {
    it('reads One Dark and gives a key carrying no color the editor foreground', () => {
      // Arrange
      const family: ThemeFamilyOutput = {
        themes: [
          { name: 'One Light', style: { 'editor.foreground': '#242529ff', syntax: { keyword: { color: '#a449abff' } } } },
          { name: 'One Dark', style: { 'editor.foreground': '#acb2beff', syntax: { keyword: { color: '#b477cfff' }, hint: { color: null } } } },
        ],
      }

      // Act
      const syntax = toSyntaxTheme(family)

      // Assert
      assertEquals(syntax, { foreground: '#acb2be', colors: { keyword: '#b477cf', hint: '#acb2be' } })
    })

    it('refuses a file without One Dark rather than reading another theme', () => {
      // Act & Assert
      assertThrows(() => toSyntaxTheme({ themes: [] }), CliError, 'no theme named One Dark')
    })
  })

  describe('colorCharacters', () => {
    it('looks a capture up by its longest dotted prefix among the keys', () => {
      // Arrange
      const captures = [{ name: 'punctuation.special.jsx', start: 0, end: 1 }, { name: 'punctuation.delimiter', start: 1, end: 2 }]

      // Act
      const colors = colorCharacters({ length: 2, captures, theme })

      // Assert
      assertEquals(colors, [{ color: '#b1574b', capture: 'punctuation.special.jsx' }, { color: '#acb2be', capture: 'punctuation.delimiter' }])
    })

    it('lets an inner capture beat the node around it, and the outer one resume after it', () => {
      // Arrange
      const captures = [{ name: 'function', start: 0, end: 3 }, { name: 'variable', start: 1, end: 2 }]

      // Act
      const colors = colorCharacters({ length: 3, captures, theme }).map((character) => character.color)

      // Assert
      assertEquals(colors, ['#73ade9', '#dce0e5', '#73ade9'])
    })

    it('lets the later of two captures on one node win', () => {
      // Arrange
      const captures = [{ name: 'variable', start: 0, end: 1 }, { name: 'function', start: 0, end: 1 }]

      // Act
      const colors = colorCharacters({ length: 1, captures, theme })

      // Assert
      assertEquals(colors, [{ color: '#73ade9', capture: 'function' }])
    })

    it('skips a capture matching no key, so the node around it shows through', () => {
      // Arrange
      const captures = [{ name: 'function', start: 0, end: 2 }, { name: 'text.jsx', start: 0, end: 2 }]

      // Act
      const colors = colorCharacters({ length: 3, captures, theme })

      // Assert
      assertEquals(colors, [{ color: '#73ade9', capture: 'function' }, { color: '#73ade9', capture: 'function' }, { color: '#acb2be', capture: '-' }])
    })

    it('matches a key only up to a dot, so a capture merely starting with its text is skipped', () => {
      // Arrange
      const captures = [{ name: 'variables', start: 0, end: 1 }]

      // Act
      const colors = colorCharacters({ length: 1, captures, theme })

      // Assert
      assertEquals(colors, [{ color: '#acb2be', capture: '-' }])
    })
  })
})
