import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { themeFamilyOutput, themeModuleInput } from './schema.ts'

describe('All Zed Parity Schema Tests', () => {
  describe('themeFamilyOutput', () => {
    it('reads the name, editor foreground, and syntax colors, dropping the rest', () => {
      // Arrange
      const raw = {
        name: 'One',
        themes: [{ name: 'One Dark', appearance: 'dark', style: { 'editor.foreground': '#acb2beff', background: '#3b414dff', syntax: { title: { color: '#d07277ff', font_weight: 400 } } } }],
      }

      // Act
      const family = themeFamilyOutput.parse(raw)

      // Assert
      assertEquals(family, { themes: [{ name: 'One Dark', style: { 'editor.foreground': '#acb2beff', syntax: { title: { color: '#d07277ff' } } } }] })
    })

    it('reads a syntax key whose color is null, which takes the editor foreground', () => {
      // Arrange
      const raw = { themes: [{ name: 'One Dark', style: { 'editor.foreground': '#acb2beff', syntax: { hint: { color: null } } } }] }

      // Act
      const family = themeFamilyOutput.parse(raw)

      // Assert
      assertEquals(family, raw)
    })

    it('refuses a theme without an editor foreground', () => {
      // Act & Assert
      assertThrows(() => themeFamilyOutput.parse({ themes: [{ name: 'One Dark', style: { syntax: {} } }] }))
    })
  })

  describe('themeModuleInput', () => {
    it('reads the theme a module exports as zedOneDark, dropping its other exports', () => {
      // Arrange
      const module = {
        CODE_THEME: 'zed-one-dark',
        zedOneDark: { name: 'zed-one-dark', type: 'dark', fg: '#acb2be', settings: [{ settings: { foreground: '#acb2be' } }, { scope: ['keyword'], settings: { foreground: '#b477cf' } }] },
      }

      // Act
      const parsed = themeModuleInput.parse(module)

      // Assert
      assertEquals(parsed, {
        zedOneDark: { name: 'zed-one-dark', type: 'dark', fg: '#acb2be', settings: [{ settings: { foreground: '#acb2be' } }, { scope: ['keyword'], settings: { foreground: '#b477cf' } }] },
      })
    })

    it('refuses a module exporting its theme under another name', () => {
      // Act & Assert
      assertThrows(() => themeModuleInput.parse({ default: { name: 'zed-one-dark', type: 'dark', fg: '#acb2be', settings: [] } }))
    })
  })
})
