import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { SAMPLES, selectLanguages } from './languages.ts'

describe('All Zed Parity Languages Tests', () => {
  describe('selectLanguages', () => {
    it('selects every compared language when none is named', () => {
      // Act
      const names = selectLanguages(undefined).map((language) => language.name)

      // Assert
      assertEquals(names, ['bash', 'css', 'html', 'json', 'tsx', 'typescript', 'yaml'])
    })

    it('selects the one language named', () => {
      // Act
      const languages = selectLanguages('tsx')

      // Assert
      assertEquals(languages, [{ name: 'tsx', grammar: 'tree-sitter-typescript/tree-sitter-tsx.wasm', queries: 'crates/grammars/src/tsx/highlights.scm' }])
    })

    it('refuses a language the theme colors but the tool cannot compare, naming why', () => {
      // Act & Assert
      assertThrows(() => selectLanguages('markdown'), CliError, 'Cannot compare markdown: no wasm build')
    })

    it('refuses a language the theme does not color', () => {
      // Act & Assert
      assertThrows(() => selectLanguages('rust'), CliError, 'Unknown language: "rust"')
    })
  })

  describe('SAMPLES', () => {
    it('holds every compared language and markdown, which only redundant colors', () => {
      // Act & Assert
      assertEquals(SAMPLES, ['bash', 'css', 'html', 'json', 'tsx', 'typescript', 'yaml', 'markdown'])
    })
  })
})
