import { assert, assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import type { Mismatch } from './diff.ts'
import { captureNames, capturePattern, changeRows, paletteEntryPattern, paletteRows, parsePalette, pinRows, queryCommentPattern, queryRow, queryStringPattern } from './update.ts'

const themeSource = [
  "import type { ThemeRegistration } from 'shiki/core'",
  '',
  'const before = Object.freeze({',
  "  keyword: '#111111',",
  '})',
  '',
  'const palette = Object.freeze({',
  "  attribute: '#74ade8',",
  "  'comment.doc': '#878e98',",
  '})',
  '',
  'const after = Object.freeze({',
  "  string: '#222222',",
  '})',
].join('\n')

const paletteOf = (lines: string[]): string => ['const palette = Object.freeze({', ...lines, '})'].join('\n')

const boolean: Mismatch = {
  language: 'json',
  fragment: 'true',
  ours: '#dfc184',
  selector: 'constant',
  zed: '#bf956a',
  capture: 'boolean',
  scopes: ['constant.language.json'],
}
const embedded: Mismatch = {
  language: 'bash',
  fragment: ':-',
  ours: '#6eb4bf',
  selector: 'keyword.operator',
  zed: '#dce0e5',
  capture: 'embedded',
  scopes: ['keyword.operator.expansion.shell'],
}

describe('All Zed Parity Update Tests', () => {
  describe('parsePalette', () => {
    it('reads the palette entries and nothing before or after the block', () => {
      // Act
      const palette = parsePalette(themeSource)

      // Assert
      assertEquals(palette, { attribute: '#74ade8', 'comment.doc': '#878e98' })
    })

    it('reads an upper-case or 8-digit color as six lower-case digits, the form One Dark compares in', () => {
      // Act
      const palette = parsePalette(paletteOf(["  keyword: '#B477CF',", "  string: '#a1c181ff',"]))

      // Assert
      assertEquals(palette, { keyword: '#b477cf', string: '#a1c181' })
    })

    it('skips blank and comment lines inside the block', () => {
      // Act
      const palette = parsePalette(paletteOf(['', '  // the base colors', "  keyword: '#b477cf',"]))

      // Assert
      assertEquals(palette, { keyword: '#b477cf' })
    })

    it('refuses a palette line it cannot read rather than leaving the entry out of the report', () => {
      // Act & Assert
      assertThrows(() => parsePalette(paletteOf(["  keyword: '#b477cf',", '  string: shared.green,'])), CliError, 'Cannot read the palette line "string: shared.green,"')
    })

    it('refuses a source without the palette block rather than reporting no drift', () => {
      // Act & Assert
      assertThrows(() => parsePalette('const colors = {}'), CliError, 'Found no palette entries')
    })
  })

  describe('pinRows', () => {
    it('names the commit both links pin', () => {
      // Act & Assert
      assertEquals(pinRows('250b6581b5b346855cccfb909839d47711cf910b'), [{ links: 'one.json, crates/grammars/src', commit: '250b6581b5b346855cccfb909839d47711cf910b' }])
    })
  })

  describe('paletteRows', () => {
    it('lists a key whose color differs from the current One Dark, even when the pinned one agrees with it', () => {
      // Act
      const rows = paletteRows({ ours: { comment: '#5d636f' }, pinned: { comment: '#5d6370' }, current: { comment: '#5d6370' } })

      // Assert
      assertEquals(rows, [{ key: 'comment', ours: '#5d636f', pinned: '#5d6370', current: '#5d6370' }])
    })

    it('lists a key One Dark changed since the pinned checkout, even when ours already matches the change', () => {
      // Act
      const rows = paletteRows({ ours: { comment: '#5d6370' }, pinned: { comment: '#5d636f' }, current: { comment: '#5d6370' } })

      // Assert
      assertEquals(rows, [{ key: 'comment', ours: '#5d6370', pinned: '#5d636f', current: '#5d6370' }])
    })

    it('leaves out a key that agrees everywhere', () => {
      // Act & Assert
      assertEquals(paletteRows({ ours: { attribute: '#74ade8' }, pinned: { attribute: '#74ade8' }, current: { attribute: '#74ade8' } }), [])
    })

    it('shows a key One Dark lacks as a dash, including one named like an inherited property', () => {
      // Act
      const rows = paletteRows({ ours: { constructor: '#73ade9' }, pinned: {}, current: {} })

      // Assert
      assertEquals(rows, [{ key: 'constructor', ours: '#73ade9', pinned: '-', current: '-' }])
    })
  })

  describe('captureNames', () => {
    it('lists each capture once, skipping text inside strings and comments', () => {
      // Arrange
      const query = [
        '; @comment.in.a.comment',
        '"@media" @keyword',
        '(identifier) @variable (#match? @variable "^[A-Z]")',
        '(type_identifier) @type @tag.component.jsx',
      ].join('\n')

      // Act & Assert
      assertEquals(captureNames(query), ['keyword', 'tag.component.jsx', 'type', 'variable'])
    })

    it('keeps the captures after a string holding a semicolon, which is no comment', () => {
      // Act & Assert
      assertEquals(captureNames('";" @punctuation.delimiter'), ['punctuation.delimiter'])
    })
  })

  describe('queryRow', () => {
    it('names the captures a changed query added and removed', () => {
      // Act
      const row = queryRow({ language: 'css', pinned: '(unit) @type.unit', current: '(unit) @number.unit' })

      // Assert
      assertEquals(row, { language: 'css', query: 'changed', added: 'number.unit', removed: 'type.unit' })
    })

    it('reports an identical query as unchanged', () => {
      // Act
      const row = queryRow({ language: 'json', pinned: '(null) @constant.builtin', current: '(null) @constant.builtin' })

      // Assert
      assertEquals(row, { language: 'json', query: 'unchanged', added: '-', removed: '-' })
    })

    it('reports a query whose patterns changed as changed, even when it assigns the same captures', () => {
      // Act
      const row = queryRow({ language: 'json', pinned: '(null) @constant.builtin', current: '[(null) (true)] @constant.builtin' })

      // Assert
      assertEquals(row, { language: 'json', query: 'changed', added: '-', removed: '-' })
    })
  })

  describe('changeRows', () => {
    it('marks a mismatch only the current run holds as new and one only the pinned run holds as resolved', () => {
      // Act
      const rows = changeRows([boolean], [embedded])

      // Assert
      assertEquals(rows, [
        { change: 'new', language: 'bash', fragment: ':-', ours: '#6eb4bf', selector: 'keyword.operator', zed: '#dce0e5', capture: 'embedded' },
        { change: 'resolved', language: 'json', fragment: 'true', ours: '#dfc184', selector: 'constant', zed: '#bf956a', capture: 'boolean' },
      ])
    })

    it('lists nothing when both runs agree', () => {
      // Act & Assert
      assertEquals(changeRows([boolean], [boolean]), [])
    })

    it('lists a mismatch whose Zed color changed as both resolved and new', () => {
      // Act
      const rows = changeRows([boolean], [{ ...boolean, zed: '#d07277' }])

      // Assert
      assertEquals(rows.map((row) => [row.change, row.zed]), [['new', '#d07277'], ['resolved', '#bf956a']])
    })
  })

  describe('paletteEntryPattern', () => {
    it('matches a bare and a quoted key at two spaces of indent', () => {
      // Act & Assert
      assertEquals(paletteEntryPattern.exec("  primary: '#acb2be',")?.slice(1), ['primary', '#acb2be'])
      assertEquals(paletteEntryPattern.exec("  'string.regex': '#bf956a',")?.slice(1), ['string.regex', '#bf956a'])
    })

    it('matches an upper-case and an 8-digit color, which the parser normalizes', () => {
      // Act & Assert
      assertEquals(paletteEntryPattern.exec("  primary: '#ACB2BE',")?.slice(1), ['primary', '#ACB2BE'])
      assertEquals(paletteEntryPattern.exec("  primary: '#acb2beff',")?.slice(1), ['primary', '#acb2beff'])
    })

    it('refuses a deeper line, which belongs to a nested object rather than the palette', () => {
      // Act & Assert
      assert(!paletteEntryPattern.test("    primary: '#acb2be',"))
    })

    it('refuses a short color or one of seven digits, which is no color the palette holds', () => {
      // Act & Assert
      assert(!paletteEntryPattern.test("  primary: '#abc',"))
      assert(!paletteEntryPattern.test("  primary: '#acb2bef',"))
    })

    it('refuses text after the entry, such as a trailing comment', () => {
      // Act & Assert
      assert(!paletteEntryPattern.test("  primary: '#acb2be', // base"))
    })
  })

  describe('capturePattern', () => {
    it('matches a dotted capture name', () => {
      // Act & Assert
      assertEquals([...'@punctuation.special'.matchAll(capturePattern)].map(([, name]) => name), ['punctuation.special'])
    })

    it('matches a capture starting with an underscore, which a query uses for a capture only its predicates read', () => {
      // Act & Assert
      assertEquals([...'@_name'.matchAll(capturePattern)].map(([, name]) => name), ['_name'])
    })

    it('refuses an at sign followed by a digit, which is no capture', () => {
      // Act & Assert
      assertEquals([...'@1x'.matchAll(capturePattern)], [])
    })
  })

  describe('queryStringPattern', () => {
    it('matches a string holding an escaped quote as one string', () => {
      // Act & Assert
      assertEquals('"a\\"b" @x'.match(queryStringPattern), ['"a\\"b"'])
    })

    it('matches across a newline, which tree-sitter query strings never hold', () => {
      // Act & Assert
      assertEquals('"a\nb"'.match(queryStringPattern), ['"a\nb"'])
    })

    it('matches across a carriage return and a tab, which the negated class also admits', () => {
      // Act & Assert
      assertEquals('"a\r\tb"'.match(queryStringPattern), ['"a\r\tb"'])
    })

    it('refuses an unclosed quote, leaving the rest of the query in place', () => {
      // Act & Assert
      assertEquals('"@media @keyword'.match(queryStringPattern), null)
    })
  })

  describe('queryCommentPattern', () => {
    it('matches from a semicolon to the end of its line only', () => {
      // Act & Assert
      assertEquals('(a) @x ; note\n(b) @y'.replace(queryCommentPattern, ''), '(a) @x \n(b) @y')
    })

    it('refuses a line without a semicolon', () => {
      // Act & Assert
      assertEquals('(a) @x'.match(queryCommentPattern), null)
    })
  })
})
