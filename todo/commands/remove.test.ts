import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../../utils/error.utils.ts'
import { runRemove } from './remove.ts'

describe('All Todo Remove Tests', () => {
  describe('runRemove', () => {
    it('removes the items at the given indices and prints the section', () => {
      // Act
      const outcome = runRemove(['0,2', 'in', 'a'], '## a\n\n- [ ] one\n- [ ] two\n- [ ] three\n')

      // Assert
      assertEquals(outcome, { text: '## a\n\n- [ ] two\n', output: '## a\n\n- [ ] two' })
    })

    it('removes a bullet with no text, which check and edit refuse', () => {
      // Act
      const outcome = runRemove(['0'], '## a\n\n- ```\n  code\n  ```\n- [ ] one\n')

      // Assert
      assertEquals(outcome.text, '## a\n\n- [ ] one\n')
    })

    it('drops a section emptied of items and prints its heading', () => {
      // Act
      const outcome = runRemove(['0', 'in', 'b'], '## a\n\n- [ ] one\n\n## b\n\n- [ ] two\n')

      // Assert
      assertEquals(outcome, { text: '## a\n\n- [ ] one\n', output: '## b' })
    })

    it('keeps a section emptied of items that still holds notes, with no blank line left at the end', () => {
      // Act
      const outcome = runRemove(['0'], '## a\n\nNotes.\n\n- [ ] one\n')

      // Assert
      assertEquals(outcome.text, '## a\n\nNotes.\n')
    })

    it('removes a whole list between two paragraphs, leaving one blank line between them', () => {
      // Act
      const outcome = runRemove(['0'], '## a\n\nBefore.\n\n- [ ] one\n\nAfter.\n')

      // Assert
      assertEquals(outcome.text, '## a\n\nBefore.\n\nAfter.\n')
    })

    it('refuses indices left apart by a space', () => {
      // Act & Assert
      assertThrows(() => runRemove(['0', '1'], '## a\n'), CliError, 'Unexpected argument: "1"')
    })
  })
})
