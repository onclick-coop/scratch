import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../../utils/error.utils.ts'
import { runCheck } from './check.ts'

describe('All Todo Check Tests', () => {
  describe('runCheck', () => {
    it('checks the items at the given indices and prints the section', () => {
      // Act
      const outcome = runCheck(['0,2', 'in', 'a'], '## a\n\n- [ ] one\n- [ ] two\n- [ ] three\n')

      // Assert
      assertEquals(outcome, {
        text: '## a\n\n- [x] one\n- [ ] two\n- [x] three\n',
        output: '## a\n\n- [x] one\n- [ ] two\n- [x] three',
      })
    })

    it('counts an empty bullet, so an index reaches the bullet a reader counts to', () => {
      // Act
      const outcome = runCheck(['1'], '## a\n\n-\n- [ ] one\n')

      // Assert
      assertEquals(outcome.text, '## a\n\n-\n- [x] one\n')
    })

    it('refuses a bullet with no text, naming it', () => {
      // Arrange
      const text = '## a\n\n- ```\n  code\n  ```\n'

      // Act & Assert
      assertThrows(() => runCheck(['0'], text), CliError, 'Item 0 on line 3 opens with no text to check')
    })

    it('refuses indices left apart by a space, suggesting them joined', () => {
      // Act
      const error = assertThrows(() => runCheck(['0', '1', 'in', 'a'], '## a\n'), CliError, 'Unexpected argument: "1"')

      // Assert
      assertEquals(error.suggestions, ['Join indices with commas: `check 0,1`'])
    })

    it('refuses a name two headings share', () => {
      // Arrange
      const text = '## a\n\n- [ ] one\n\n## a\n\n- [ ] two\n'

      // Act & Assert
      assertThrows(() => runCheck(['0', 'in', 'a'], text), CliError, 'names more than one heading')
    })
  })
})
