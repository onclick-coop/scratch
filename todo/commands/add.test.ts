import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../../utils/error.utils.ts'
import { runAdd } from './add.ts'

describe('All Todo Add Tests', () => {
  describe('runAdd', () => {
    it('adds to the named section and prints that section', () => {
      // Act
      const outcome = runAdd(['buy', 'cheese', 'in', 'a'], '## a\n\n- [ ] milk\n\n## b\n')

      // Assert
      assertEquals(outcome, {
        text: '## a\n\n- [ ] milk\n- [ ] buy cheese\n\n## b\n',
        output: '## a\n\n- [ ] milk\n- [ ] buy cheese',
      })
    })

    it('creates a section named by one word after `in`', () => {
      // Act
      const outcome = runAdd(['x', 'in', 'c'], '## a\n\n- [ ] one\n')

      // Assert
      assertEquals(outcome, { text: '## a\n\n- [ ] one\n\n## c\n\n- [ ] x\n', output: '## c\n\n- [ ] x' })
    })

    it('creates a section named by one quoted argument of several words', () => {
      // Act
      const outcome = runAdd(['x', 'in', 'sign in flow'], '')

      // Assert
      assertEquals(outcome.text, '## sign in flow\n\n- [ ] x\n')
    })

    it('reaches a section named `in` through a second `in`', () => {
      // Act
      const outcome = runAdd(['x', 'in', 'in'], '## in\n\n- [ ] one\n')

      // Assert
      assertEquals(outcome.text, '## in\n\n- [ ] one\n- [ ] x\n')
    })

    it('refuses unquoted words after an `in` that name no section, suggesting quotes', () => {
      // Arrange
      const argv = ['log', 'in', 'to', 'box']

      // Act
      const error = assertThrows(() => runAdd(argv, '## a\n\n- [ ] one\n'), CliError, 'Section "to box" not found')

      // Assert
      assertEquals(error.suggestions, [
        "Quote the item as one argument to keep `in` in its text, as `add 'log in to box'`",
        "Quote a section name of several words to create it, as `add log in 'to box'`",
      ])
    })

    it('keeps `in` in text quoted as one argument', () => {
      // Act
      const outcome = runAdd(['log in to box'], '## a\n\n- [ ] one\n')

      // Assert
      assertEquals(outcome.text, '## a\n\n- [ ] one\n- [ ] log in to box\n')
    })

    it('asks for a section name on an empty list', () => {
      // Act
      const error = assertThrows(() => runAdd(['x'], ''), CliError, 'The list has no sections yet; name one with `in <section>`')

      // Assert
      assertEquals(error.suggestions, ['Example: `add buy milk in groceries`'])
    })

    it('refuses no section name when several sections exist', () => {
      // Act & Assert
      assertThrows(() => runAdd(['x'], '## a\n\n## b\n'), CliError, 'Multiple sections present')
    })

    it('refuses an add with no text', () => {
      // Act & Assert
      assertThrows(() => runAdd(['in', 'a'], '## a\n'), CliError, 'Missing content for `add`')
    })
  })
})
