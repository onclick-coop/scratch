import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { themeFamilyOutput, themeModuleInput, themeStyleOutput } from './schema.ts'

describe('All Zed Parity Schema Tests', () => {
  describe('themeFamilyOutput', () => {
    it('reads each theme name and leaves its style unread', () => {
      // Arrange
      const raw = { name: 'One', themes: [{ name: 'One Light', appearance: 'light', style: { changed: true } }, { name: 'One Dark', style: {} }] }

      // Act
      const family = themeFamilyOutput.parse(raw)

      // Assert
      assertEquals(family, { themes: [{ name: 'One Light', style: { changed: true } }, { name: 'One Dark', style: {} }] })
    })

    it('refuses a file without a themes list', () => {
      // Act & Assert
      assertThrows(() => themeFamilyOutput.parse({ name: 'One' }))
    })
  })

  describe('themeStyleOutput', () => {
    it('reads the editor foreground and syntax colors, dropping the rest', () => {
      // Arrange
      const raw = { 'editor.foreground': '#acb2beff', background: '#3b414dff', syntax: { title: { color: '#d07277ff', font_weight: 400 } } }

      // Act
      const style = themeStyleOutput.parse(raw)

      // Assert
      assertEquals(style, { 'editor.foreground': '#acb2beff', syntax: { title: { color: '#d07277ff' } } })
    })

    it('reads a syntax key whose color is null or absent, which takes the editor foreground', () => {
      // Arrange
      const raw = { 'editor.foreground': '#acb2beff', syntax: { hint: { color: null }, emphasis: { font_style: 'italic' } } }

      // Act
      const style = themeStyleOutput.parse(raw)

      // Assert
      assertEquals(style, { 'editor.foreground': '#acb2beff', syntax: { hint: { color: null }, emphasis: {} } })
    })

    it('refuses a style without an editor foreground', () => {
      // Act & Assert
      assertThrows(() => themeStyleOutput.parse({ syntax: {} }))
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

    it('reads a comma-separated string scope and a rule that sets only a style', () => {
      // Arrange
      const module = { zedOneDark: { name: 'x', type: 'light', fg: '#000000', settings: [{ scope: 'string, comment', settings: { fontStyle: 'italic' } }] } }

      // Act
      const parsed = themeModuleInput.parse(module)

      // Assert
      assertEquals(parsed, { zedOneDark: { name: 'x', type: 'light', fg: '#000000', settings: [{ scope: 'string, comment', settings: {} }] } })
    })

    it('refuses a theme type other than light or dark, which Shiki would not register', () => {
      // Act & Assert
      assertThrows(() => themeModuleInput.parse({ zedOneDark: { name: 'x', type: 'dim', fg: '#000000', settings: [] } }))
    })

    it('refuses a module exporting its theme under another name', () => {
      // Act & Assert
      assertThrows(() => themeModuleInput.parse({ default: { name: 'zed-one-dark', type: 'dark', fg: '#acb2be', settings: [] } }))
    })
  })
})
