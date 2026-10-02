import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { addItem, addSection, dropSection, editItem, isEmptySection, listMarkerPattern, nextMarker, removeItems, setDone } from './actions.ts'
import { parse } from './parse.ts'

const RICH = [
  '# Project todos',
  '',
  'Notes before any section, with *emphasis*.',
  '',
  '- a list before any section',
  '',
  '## *urgent* fixes',
  '',
  '- [ ] write *changelog* for [v2](x)',
  '  - nested child',
  '',
  '  A second paragraph under the item.',
  '- [X] use `deno` here',
  '- plain item without a box',
  '',
  '<!-- a comment between lists -->',
  '',
  '1. [ ] ordered task',
  '',
  'Release `v3`',
  '------------',
  '',
  '- [ ] loose one',
  '',
  '- [ ] loose two',
  '',
  '| col | col |',
  '| --- | --- |',
  '| a   | b   |',
  '',
  '> - [ ] quoted task',
  '',
  '## empty section',
  '',
  '## last',
  '',
  '- ```',
  '  code item',
  '  ```',
  '- [ ] after code item',
  '',
  'Trailing paragraph at the end.',
  '',
].join('\n')

describe('All Todo Actions Tests', () => {
  describe('listMarkerPattern', () => {
    it('matches an indent and a bullet, or an indent, a number, and its delimiter', () => {
      // Act & Assert
      assertEquals(listMarkerPattern.exec('  - [ ] one')?.slice(1), ['  ', '-', undefined, undefined])
      assertEquals(listMarkerPattern.exec('10) one')?.slice(1), ['', undefined, '10', ')'])
    })

    it('refuses a line that opens with text, and a number past nine digits', () => {
      // Act & Assert
      assertEquals(listMarkerPattern.test('one - two'), false)
      assertEquals(listMarkerPattern.test('1234567890. one'), false)
    })
  })

  describe('nextMarker', () => {
    it('repeats a bullet and counts a number up, each with one space after', () => {
      // Act & Assert
      assertEquals(nextMarker('* one'), '* ')
      assertEquals(nextMarker('  9. one'), '  10. ')
      assertEquals(nextMarker('-'), '- ')
    })
  })

  describe('addItem', () => {
    it('adds an item after the last one with the same marker', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one\n\n## b\n'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'two')

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n- [ ] two\n\n## b\n')
    })

    it('writes the next number in an ordered list, keeping its delimiter', () => {
      // Arrange
      const raw = '## a\n\n1. [ ] one\n2) [ ] two\n'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'three')

      // Assert
      assertEquals(result, '## a\n\n1. [ ] one\n2) [ ] two\n3) [ ] three\n')
    })

    it('keeps the indent of an indented list', () => {
      // Arrange
      const raw = '## a\n\n  - [ ] one\n  - [ ] two\n'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'three')

      // Assert
      assertEquals(result, '## a\n\n  - [ ] one\n  - [ ] two\n  - [ ] three\n')
    })

    it('indents later lines under a marker wider than two columns', () => {
      // Arrange
      const raw = '## a\n\n10. [ ] one\n'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'two\nlines')

      // Assert
      assertEquals(result, '## a\n\n10. [ ] one\n11. [ ] two\n    lines\n')
    })

    it('writes a bullet with its space after an empty last bullet', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one\n-\n'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'two')

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n-\n- [ ] two\n')
    })

    it('adds after the last item and its nested content', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one\n  - child\n\nAfter the list.\n'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'two')

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n  - child\n- [ ] two\n\nAfter the list.\n')
    })

    it('ends the last line first when the file ends without a newline', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'two')

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n- [ ] two\n')
    })

    it('starts a list after the text of a section with no items', () => {
      // Arrange
      const raw = '## a\n\nSome notes.\n\n## b\n'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'one')

      // Assert
      assertEquals(result, '## a\n\nSome notes.\n\n- [ ] one\n\n## b\n')
    })

    it('starts a list under the heading of an empty section', () => {
      // Arrange
      const raw = '## a\n## b\n'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'one')

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n## b\n')
    })

    it('escapes the typed text and indents its later lines under the marker', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one\n'
      const [section] = parse(raw)

      // Act
      const result = addItem(raw, section, 'fix *all*\nof it')

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n- [ ] fix \\*all\\*\n  of it\n')
    })

    it('leaves every other byte of a file of mixed markdown as it was', () => {
      // Arrange
      const sections = parse(RICH)
      const [, , , last] = sections

      // Act
      const result = addItem(RICH, last, 'unrelated item')

      // Assert
      assertEquals(result, RICH.replace('- [ ] after code item\n', '- [ ] after code item\n- [ ] unrelated item\n'))
    })
  })

  describe('addSection', () => {
    it('appends a section a blank line after the end of the file', () => {
      // Act
      const result = addSection('## a\n\n- [ ] one\n', 'b', 'two')

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n\n## b\n\n- [ ] two\n')
    })

    it('writes the first section of an empty file with nothing before it', () => {
      // Act
      const result = addSection('', 'a', 'one')

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n')
    })

    it('leaves a mixed file as it was up to the new section', () => {
      // Act
      const result = addSection(RICH, 'fresh', 'brand new')

      // Assert
      assertEquals(result, `${RICH}\n## fresh\n\n- [ ] brand new\n`)
    })
  })

  describe('setDone', () => {
    it('rewrites only the checkbox character of each item', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one\n- [X] two\n'
      const [section] = parse(raw)

      // Act
      const checked = setDone(raw, section.items, true)
      const unchecked = setDone(raw, section.items, false)

      // Assert
      assertEquals(checked, '## a\n\n- [x] one\n- [X] two\n')
      assertEquals(unchecked, '## a\n\n- [ ] one\n- [ ] two\n')
    })

    it('adds a checkbox to a plain item it checks, and leaves one it unchecks', () => {
      // Arrange
      const raw = '## a\n\n- plain\n'
      const [section] = parse(raw)

      // Act
      const checked = setDone(raw, section.items, true)
      const unchecked = setDone(raw, section.items, false)

      // Assert
      assertEquals(checked, '## a\n\n- [x] plain\n')
      assertEquals(unchecked, raw)
    })

    it('changes one item once when its index is given twice', () => {
      // Arrange
      const raw = '## a\n\n- plain\n'
      const [section] = parse(raw)

      // Act
      const result = setDone(raw, [...section.items, ...section.items], true)

      // Assert
      assertEquals(result, '## a\n\n- [x] plain\n')
    })
  })

  describe('editItem', () => {
    it('replaces the first paragraph, keeping the box and the nested content', () => {
      // Arrange
      const raw = '## a\n\n- [x] old *text*\n  - child\n'
      const [section] = parse(raw)
      const [item] = section.items

      // Act
      const result = editItem(raw, item, 'new text')

      // Assert
      assertEquals(result, '## a\n\n- [x] new text\n  - child\n')
    })

    it('indents later lines under a marker wider than two columns', () => {
      // Arrange
      const raw = '## a\n\n10. [ ] one\n'
      const [section] = parse(raw)
      const [item] = section.items

      // Act
      const result = editItem(raw, item, 'two\nlines')

      // Assert
      assertEquals(result, '## a\n\n10. [ ] two\n    lines\n')
    })
  })

  describe('removeItems', () => {
    it('removes each item with its nested content and the spacing after it', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one\n  - child\n\n  more\n- [ ] two\n- [ ] three\n'
      const [section] = parse(raw)
      const [one, , three] = section.items

      // Act
      const result = removeItems(raw, section, [one, three, one])

      // Assert
      assertEquals(result, '## a\n\n- [ ] two\n')
    })

    it('keeps the indent of the items left in an indented list', () => {
      // Arrange
      const raw = '## a\n\n  - [ ] one\n  - [ ] two\n'
      const [section] = parse(raw)
      const [one] = section.items

      // Act
      const result = removeItems(raw, section, [one])

      // Assert
      assertEquals(result, '## a\n\n  - [ ] two\n')
    })

    it('removes the last item of a loose list with the blank line before it', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one\n\n- [ ] two\n\n- [ ] three\n\n## b\n'
      const [section] = parse(raw)
      const [, two, three] = section.items

      // Act
      const last = removeItems(raw, section, [three])
      const lastTwo = removeItems(raw, section, [two, three])

      // Assert
      assertEquals(last, '## a\n\n- [ ] one\n\n- [ ] two\n\n## b\n')
      assertEquals(lastTwo, '## a\n\n- [ ] one\n\n## b\n')
    })

    it('removes a middle item of a loose list with the blank line after it', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one\n\n- [ ] two\n\n- [ ] three\n'
      const [section] = parse(raw)
      const [, two] = section.items

      // Act
      const result = removeItems(raw, section, [two])

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n\n- [ ] three\n')
    })
  })

  describe('isEmptySection', () => {
    it('reads a section with only its heading and blank lines as empty', () => {
      // Arrange
      const raw = '## a\n\n\n## b\n\nNotes.\n'
      const [a, b] = parse(raw)

      // Act & Assert
      assertEquals(isEmptySection(raw, a), true)
      assertEquals(isEmptySection(raw, b), false)
    })
  })

  describe('dropSection', () => {
    it('removes a section that has another after it, blank line included', () => {
      // Arrange
      const raw = '## a\n\n## b\n\n- [ ] two\n'
      const [a] = parse(raw)

      // Act
      const result = dropSection(raw, a)

      // Assert
      assertEquals(result, '## b\n\n- [ ] two\n')
    })

    it('removes the last section and the blank line that set it off', () => {
      // Arrange
      const raw = '## a\n\n- [ ] one\n\n## b\n'
      const [, b] = parse(raw)

      // Act
      const result = dropSection(raw, b)

      // Assert
      assertEquals(result, '## a\n\n- [ ] one\n')
    })

    it('leaves an empty file when the only section goes', () => {
      // Arrange
      const raw = '## a\n'
      const [a] = parse(raw)

      // Act
      const result = dropSection(raw, a)

      // Assert
      assertEquals(result, '')
    })
  })
})
