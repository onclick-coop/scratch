import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseConfig } from './config.ts'

describe('All Todo Config Tests', () => {
  describe('parseConfig', () => {
    it('reads the file the section names', () => {
      // Act
      const config = parseConfig('{ "todo": { "file": "notes/TODO.md" } }')

      // Assert
      assertEquals(config, { file: 'notes/TODO.md' })
    })

    it('reads an absent section as TODO.md', () => {
      // Act
      const config = parseConfig('{ "commit": { "maxLength": 50 } }')

      // Assert
      assertEquals(config, { file: 'TODO.md' })
    })

    it('reads an empty section as TODO.md', () => {
      // Act
      const config = parseConfig('{ "todo": {} }')

      // Assert
      assertEquals(config, { file: 'TODO.md' })
    })

    it('refuses a misspelled key rather than falling back to TODO.md', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "todo": { "path": "notes/TODO.md" } }'), CliError, 'Unrecognized key: "path"')
    })

    it('refuses an empty file, which would name the calling directory itself', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "todo": { "file": "" } }'), CliError, 'todo section the tool cannot read')
    })

    it('refuses a file that is not a string', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "todo": { "file": 3 } }'), CliError, 'todo section the tool cannot read')
    })

    it('refuses a null section', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "todo": null }'), CliError, 'todo section the tool cannot read')
    })
  })
})
