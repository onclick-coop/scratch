import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { continuationIndentPattern, parse, taskBoxPattern } from './parse.ts'

describe('All Todo Parse Tests', () => {
  describe('continuationIndentPattern', () => {
    it('matches a line break and the spaces or tabs that indent the next line', () => {
      // Act & Assert
      assertEquals('two\n  lines\n\tmore'.replaceAll(continuationIndentPattern, '\n'), 'two\nlines\nmore')
    })

    it('refuses a line break with no indent after it', () => {
      // Act & Assert
      assertEquals('two\nlines'.replaceAll(continuationIndentPattern, '|'), 'two\nlines')
    })

    it('refuses spaces inside a line, which belong to the text', () => {
      // Act & Assert
      assertEquals('two  words'.replaceAll(continuationIndentPattern, '|'), 'two  words')
    })
  })

  describe('taskBoxPattern', () => {
    it('matches an open, a done, and a capital done box with the space after it', () => {
      // Act & Assert
      assertEquals(taskBoxPattern.exec('- [ ] ')?.index, 2)
      assertEquals(taskBoxPattern.exec('- [x] ')?.index, 2)
      assertEquals(taskBoxPattern.exec('  * [X]\t')?.index, 4)
    })

    it('refuses a box that is not at the end, which would sit inside the text', () => {
      // Act & Assert
      assertEquals(taskBoxPattern.test('- [x] more'), false)
    })

    it('refuses a box with another character inside', () => {
      // Act & Assert
      assertEquals(taskBoxPattern.test('- [-] '), false)
    })

    it('refuses a box followed by a line break, which ends the line rather than the marker', () => {
      // Act & Assert
      assertEquals(taskBoxPattern.test('- [ ]\n'), false)
    })
  })

  describe('parse', () => {
    it('reads each section with its name and its items', () => {
      // Arrange
      const raw = '## groceries\n\n- [ ] buy milk\n- [x] buy bread\n'

      // Act
      const sections = parse(raw)

      // Assert
      assertEquals(sections, [{
        name: 'groceries',
        line: 1,
        start: 0,
        headingEnd: 12,
        end: 45,
        items: [{
          content: 'buy milk',
          done: false,
          hasBox: true,
          hasText: true,
          isLast: false,
          line: 3,
          start: 14,
          markerEnd: 16,
          textStart: 20,
          textEnd: 28,
          end: 29,
        }, {
          content: 'buy bread',
          done: true,
          hasBox: true,
          hasText: true,
          isLast: true,
          line: 4,
          start: 29,
          markerEnd: 31,
          textStart: 35,
          textEnd: 44,
          end: 45,
        }],
      }])
    })

    it('reads an indented heading and indented items from the start of their lines', () => {
      // Arrange
      const raw = '   ## a\n\n  - [ ] one\n  - [ ] two\n'

      // Act
      const [section] = parse(raw)

      // Assert
      assertEquals([section.name, section.start, section.headingEnd], ['a', 0, 7])
      assertEquals(section.items.map((item) => raw.slice(item.start, item.end)), ['  - [ ] one\n', '  - [ ] two\n'])
      assertEquals(section.items.map((item) => item.markerEnd - item.start), [4, 4])
    })

    it('ends a section where the next one starts', () => {
      // Act
      const sections = parse('## a\n\n- [ ] one\n\n## b\n\n- [x] two\n')

      // Assert
      assertEquals(sections.map((section) => [section.name, section.start, section.end]), [['a', 0, 17], ['b', 17, 33]])
    })

    it('names a section by its heading text with the markup read through', () => {
      // Act
      const sections = parse('## *urgent* `v2` fixes\n\nRelease three\n-------------\n')

      // Assert
      assertEquals(sections.map((section) => section.name), ['urgent v2 fixes', 'Release three'])
    })

    it('keeps emphasis, links, and code in an item as written', () => {
      // Act
      const [section] = parse('## a\n\n- [ ] write *changelog* for [v2](x)\n- [x] use `deno` here\n')

      // Assert
      assertEquals(section.items.map((item) => item.content), ['write *changelog* for [v2](x)', 'use `deno` here'])
    })

    it('keeps an item that opens with markup, starting its text past the task marker', () => {
      // Act
      const [section] = parse('## a\n\n- [ ] *bold* first\n')

      // Assert
      assertEquals(section.items.map((item) => [item.content, item.markerEnd, item.textStart]), [['*bold* first', 8, 12]])
    })

    it('reads a multi-line item with the indent of its later lines dropped', () => {
      // Act
      const [section] = parse('## a\n\n- [ ] two\n  lines here\n')

      // Assert
      assertEquals(section.items.map((item) => item.content), ['two\nlines here'])
    })

    it('spans an item over its nested list and later paragraph, up to the next item', () => {
      // Arrange
      const raw = '## a\n\n- [ ] parent\n  - child\n\n  more text\n- [ ] next\n'

      // Act
      const [section] = parse(raw)

      // Assert
      const spans = section.items.map((item) => raw.slice(item.start, item.end))
      assertEquals(spans, ['- [ ] parent\n  - child\n\n  more text\n', '- [ ] next\n'])
    })

    it('reads a plain list item as not done and without a box', () => {
      // Act
      const [section] = parse('## a\n\n- plain\n')

      // Assert
      const [item] = section.items
      assertEquals([item.content, item.done, item.hasBox, item.markerEnd, item.textStart], ['plain', false, false, 8, 8])
    })

    it('counts every bullet, marking one that opens with no paragraph as holding no text', () => {
      // Act
      const [section] = parse('## a\n\n-\n- ```\n  code\n  ```\n- [ ] after\n')

      // Assert
      const shapes = section.items.map((item) => [item.line, item.hasText, item.content])
      assertEquals(shapes, [[3, false, ''], [4, false, ''], [7, true, 'after']])
    })

    it('reads lists before any section and inside a quote as no items', () => {
      // Act
      const sections = parse('- [ ] orphan\n\n## a\n\n> - [ ] quoted\n')

      // Assert
      assertEquals(sections.map((section) => section.items.length), [0])
    })

    it('reads lists under a deeper heading as items of the section above', () => {
      // Act
      const [section] = parse('## a\n\n- [ ] one\n\n### sub\n\n- [ ] two\n')

      // Assert
      assertEquals(section.items.map((item) => item.content), ['one', 'two'])
    })

    it('returns no sections for empty input', () => {
      // Act & Assert
      assertEquals(parse(''), [])
    })
  })
})
