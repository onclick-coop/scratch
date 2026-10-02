import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../../utils/error.utils.ts'
import { runUncheck } from './uncheck.ts'

describe('All Todo Uncheck Tests', () => {
  describe('runUncheck', () => {
    it('unchecks the items at the given indices, a capital box included', () => {
      // Act
      const outcome = runUncheck(['0,1'], '## a\n\n- [x] one\n- [X] two\n')

      // Assert
      assertEquals(outcome, { text: '## a\n\n- [ ] one\n- [ ] two\n', output: '## a\n\n- [ ] one\n- [ ] two' })
    })

    it('refuses indices left apart by a space', () => {
      // Act & Assert
      assertThrows(() => runUncheck(['0', '1'], '## a\n'), CliError, 'Unexpected argument: "1"')
    })
  })
})
