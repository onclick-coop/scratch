import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../../utils/error.utils.ts'
import { runList } from './list.ts'

describe('All Todo List Tests', () => {
  describe('runList', () => {
    it('prints the whole file and leaves it as it is', () => {
      // Act
      const outcome = runList([], 'Notes.\n\n## a\n\n- [ ] one\n')

      // Assert
      assertEquals(outcome, { text: 'Notes.\n\n## a\n\n- [ ] one\n', output: 'Notes.\n\n## a\n\n- [ ] one' })
    })

    it('prints one section', () => {
      // Act
      const outcome = runList(['in', 'b'], '## a\n\n- [ ] one\n\n## b\n\n- [ ] two\n')

      // Assert
      assertEquals(outcome.output, '## b\n\n- [ ] two')
    })

    it('refuses words before `in`, suggesting the form that names a section', () => {
      // Act
      const error = assertThrows(() => runList(['t', 'extra'], '## a\n'), CliError, 'Unexpected argument: "t"')

      // Assert
      assertEquals(error.suggestions, ['Name a section with `list in <section>`'])
    })
  })
})
