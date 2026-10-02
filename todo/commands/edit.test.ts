import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../../utils/error.utils.ts'
import { runEdit } from './edit.ts'

describe('All Todo Edit Tests', () => {
  describe('runEdit', () => {
    it('rewrites the item at the index, escaping the typed text', () => {
      // Act
      const outcome = runEdit(['1', 'fix', '*all*', 'in', 'a'], '## a\n\n- [ ] one\n- [x] two\n')

      // Assert
      assertEquals(outcome, {
        text: '## a\n\n- [ ] one\n- [x] fix \\*all\\*\n',
        output: '## a\n\n- [ ] one\n- [x] fix \\*all\\*',
      })
    })

    it('refuses a bullet with no text, naming it', () => {
      // Act & Assert
      assertThrows(() => runEdit(['0', 'x'], '## a\n\n-\n'), CliError, 'Item 0 on line 3 opens with no text to edit')
    })

    it('refuses more than one index', () => {
      // Act & Assert
      assertThrows(() => runEdit(['0,1', 'x'], '## a\n\n- [ ] one\n'), CliError, '`edit` takes exactly one index')
    })
  })
})
