import { assertEquals, assertThrows } from '@std/assert'
import { fromFileUrl } from '@std/path'
import { describe, it } from 'node:test'
import { callerDirectory, configSection, readConfigText } from './config.utils.ts'
import { CliError } from './error.utils.ts'

describe('All Config Utils Tests', () => {
  describe('callerDirectory', () => {
    it('falls back to the working directory when the run has no env access to INIT_CWD', () => {
      // Act & Assert
      assertEquals(callerDirectory(), Deno.cwd())
    })
  })

  describe('readConfigText', () => {
    it('reads a directory holding no tools.config.json as an empty config, so every tool takes its defaults', async () => {
      // Arrange
      const directory = fromFileUrl(new URL('.', import.meta.url))

      // Act
      const text = await readConfigText(directory)

      // Assert
      assertEquals(text, '{}')
    })
  })

  describe('configSection', () => {
    it('returns the section keyed by the tool name', () => {
      // Act & Assert
      assertEquals(configSection('{ "commit": { "maxLength": 50 }, "other": 1 }', 'commit'), { maxLength: 50 })
    })

    it('returns an empty section when the file names none for the tool', () => {
      // Act & Assert
      assertEquals(configSection('{ "other": 1 }', 'commit'), {})
    })

    it('returns a null section as written, for the tool to refuse', () => {
      // Act & Assert
      assertEquals(configSection('{ "commit": null }', 'commit'), null)
    })

    it('reads a key named like an inherited property as absent', () => {
      // Act & Assert
      assertEquals(configSection('{}', 'constructor'), {})
    })

    it('refuses text that is not JSON', () => {
      // Act & Assert
      assertThrows(() => configSection('{ bad json', 'commit'), CliError, 'is not valid JSON')
    })

    it('refuses JSON that is not an object keyed by tool name, showing the shape to use', () => {
      // Act
      const error = assertThrows(() => configSection('[1, 2]', 'commit'), CliError, 'must hold an object keyed by tool name')

      // Assert
      assertEquals(error.suggestions, ['Write it as { "commit": { ... } }'])
    })

    it('refuses a null file the same way', () => {
      // Act & Assert
      assertThrows(() => configSection('null', 'commit'), CliError, 'must hold an object keyed by tool name')
    })
  })
})
