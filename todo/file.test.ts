import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { runAdd } from './commands/add.ts'
import { runCheck } from './commands/check.ts'
import { runEdit } from './commands/edit.ts'
import { runList } from './commands/list.ts'
import { runRemove } from './commands/remove.ts'
import { runUncheck } from './commands/uncheck.ts'
import { bareLineFeedPattern, runOnFile } from './file.ts'

const BOM = '\u{FEFF}'

describe('All Todo File Tests', () => {
  describe('bareLineFeedPattern', () => {
    it('matches a line feed with no carriage return before it', () => {
      // Act & Assert
      assertEquals(bareLineFeedPattern.test('a\r\nb\nc'), true)
      assertEquals(bareLineFeedPattern.test('\n'), true)
    })

    it('refuses text whose every line feed follows a carriage return', () => {
      // Act & Assert
      assertEquals(bareLineFeedPattern.test('a\r\nb\r\n'), false)
      assertEquals(bareLineFeedPattern.test('no breaks'), false)
    })
  })

  describe('runOnFile', () => {
    it('lists a file with a byte-order mark without printing the mark', () => {
      // Act
      const outcome = runOnFile(runList, [], `${BOM}## a\n\n- [ ] one\n`)

      // Assert
      assertEquals(outcome, { text: `${BOM}## a\n\n- [ ] one\n`, output: '## a\n\n- [ ] one' })
    })

    it('adds to a file with a byte-order mark, keeping the mark in front', () => {
      // Act
      const outcome = runOnFile(runAdd, ['two', 'in', 'a'], `${BOM}## a\n\n- [ ] one\n`)

      // Assert
      assertEquals(outcome.text, `${BOM}## a\n\n- [ ] one\n- [ ] two\n`)
    })

    it('checks and unchecks the right box in a file with a byte-order mark', () => {
      // Act
      const checked = runOnFile(runCheck, ['1'], `${BOM}## a\n\n- [ ] one\n- [ ] two\n`)
      const unchecked = runOnFile(runUncheck, ['0'], `${BOM}## a\n\n- [x] one\n- [ ] two\n`)

      // Assert
      assertEquals(checked.text, `${BOM}## a\n\n- [ ] one\n- [x] two\n`)
      assertEquals(unchecked.text, `${BOM}## a\n\n- [ ] one\n- [ ] two\n`)
    })

    it('edits the right item in a file with a byte-order mark', () => {
      // Act
      const outcome = runOnFile(runEdit, ['0', 'uno'], `${BOM}## a\n\n- [ ] one\n- [ ] two\n`)

      // Assert
      assertEquals(outcome.text, `${BOM}## a\n\n- [ ] uno\n- [ ] two\n`)
    })

    it('removes the right item in a file with a byte-order mark', () => {
      // Act
      const outcome = runOnFile(runRemove, ['0'], `${BOM}## a\n\n- [ ] one\n- [ ] two\n`)

      // Assert
      assertEquals(outcome.text, `${BOM}## a\n\n- [ ] two\n`)
    })

    it('writes the lines it adds to a CRLF file with CRLF, with no stray blank line', () => {
      // Arrange
      const raw = '## a\r\n\r\n## b\r\n\r\n- [ ] x\r\n'

      // Act
      const outcome = runOnFile(runAdd, ['one', 'in', 'a'], raw)

      // Assert
      assertEquals(outcome, { text: '## a\r\n\r\n- [ ] one\r\n\r\n## b\r\n\r\n- [ ] x\r\n', output: '## a\n\n- [ ] one' })
    })

    it('removes the last item of a CRLF file, leaving one line ending at the end', () => {
      // Act
      const outcome = runOnFile(runRemove, ['0', 'in', 'b'], '## a\r\n\r\n- [ ] one\r\n\r\n## b\r\n\r\n- [ ] x\r\n')

      // Assert
      assertEquals(outcome.text, '## a\r\n\r\n- [ ] one\r\n')
    })

    it('hands back the file untouched when a command changes nothing', () => {
      // Arrange
      const raw = `${BOM}## a\r\n\r\n- [x] one\r\n`

      // Act
      const outcome = runOnFile(runCheck, ['0'], raw)

      // Assert
      assertEquals(outcome.text, raw)
    })

    it('adds with a line feed to a file that mixes line endings', () => {
      // Act
      const outcome = runOnFile(runAdd, ['two'], '## a\r\n\n- [ ] one\n')

      // Assert
      assertEquals(outcome.text, '## a\r\n\n- [ ] one\n- [ ] two\n')
    })
  })
})
