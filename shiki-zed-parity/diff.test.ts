import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { diffColors, type Mismatch, summarize, toPieces, toRows } from './diff.ts'

const mismatch: Mismatch = {
  language: 'json',
  fragment: 'true',
  ours: '#dfc184',
  selector: 'constant',
  zed: '#bf956a',
  capture: 'boolean',
  scopes: ['meta.structure.dictionary.json', 'meta.structure.dictionary.value.json', 'constant.language.json', 'extra.scope'],
}

describe('All Zed Parity Diff Tests', () => {
  describe('toPieces', () => {
    it('splits a token into its explained pieces at their own offsets without the root scope', () => {
      // Arrange
      const lines = [[{
        content: 'a:',
        offset: 4,
        color: '#D07277',
        explanation: [
          { content: 'a', scopes: [{ scopeName: 'source.yaml' }, { scopeName: 'entity.name.tag.yaml' }] },
          { content: ':', scopes: [{ scopeName: 'source.yaml' }, { scopeName: 'punctuation.separator.key-value.mapping.yaml' }] },
        ],
      }]]

      // Act
      const pieces = toPieces(lines)

      // Assert
      assertEquals(pieces, [
        { content: 'a', offset: 4, color: '#d07277', scopes: ['entity.name.tag.yaml'] },
        { content: ':', offset: 5, color: '#d07277', scopes: ['punctuation.separator.key-value.mapping.yaml'] },
      ])
    })

    it('keeps a token Shiki gave no explanation as one piece with no scopes', () => {
      // Act
      const pieces = toPieces([[{ content: 'ab', offset: 2, color: '#ACB2BE' }]])

      // Assert
      assertEquals(pieces, [{ content: 'ab', offset: 2, color: '#acb2be', scopes: [] }])
    })
  })

  describe('diffColors', () => {
    it('lists a piece Zed colors differently, once per differing color, with the selector that won it', () => {
      // Arrange
      const pieces = [{ content: 'a.b', offset: 0, color: '#74ade8', scopes: ['support.class.component.tsx'] }]
      const winners = ['support.class.component', 'support.class.component', 'support.class.component']
      const zed = [
        { color: '#74ade8', capture: 'tag.component.jsx' },
        { color: '#b2b9c6', capture: 'punctuation.delimiter' },
        { color: '#74ade8', capture: 'tag.component.jsx' },
      ]

      // Act
      const mismatches = diffColors({ language: 'tsx', code: 'a.b', pieces, winners, zed })

      // Assert
      assertEquals(mismatches, [{
        language: 'tsx',
        fragment: 'a.b',
        ours: '#74ade8',
        selector: 'support.class.component',
        zed: '#b2b9c6',
        capture: 'punctuation.delimiter',
        scopes: ['support.class.component.tsx'],
      }])
    })

    it('lists each differing color in a piece, naming the selector that won the piece where it starts', () => {
      // Arrange
      const pieces = [{ content: 'x', offset: 0, color: '#acb2be', scopes: [] }, { content: 'a.b', offset: 1, color: '#74ade8', scopes: ['s'] }]
      const winners = ['default', 'support.class', 'support.class', 'support.class']
      const zed = [
        { color: '#acb2be', capture: '-' },
        { color: '#d07277', capture: 'variable' },
        { color: '#b2b9c6', capture: 'punctuation.delimiter' },
        { color: '#74ade8', capture: 'tag' },
      ]

      // Act
      const mismatches = diffColors({ language: 'tsx', code: 'xa.b', pieces, winners, zed })

      // Assert
      assertEquals(mismatches, [
        { language: 'tsx', fragment: 'a.b', ours: '#74ade8', selector: 'support.class', zed: '#d07277', capture: 'variable', scopes: ['s'] },
        { language: 'tsx', fragment: 'a.b', ours: '#74ade8', selector: 'support.class', zed: '#b2b9c6', capture: 'punctuation.delimiter', scopes: ['s'] },
      ])
    })

    it('ignores whitespace, which renders no color', () => {
      // Arrange
      const pieces = [{ content: ' x', offset: 0, color: '#acb2be', scopes: [] }]
      const zed = [{ color: '#73ade9', capture: 'function' }, { color: '#acb2be', capture: '-' }]

      // Act
      const mismatches = diffColors({ language: 'bash', code: ' x', pieces, winners: ['default', 'default'], zed })

      // Assert
      assertEquals(mismatches, [])
    })

    it('lists a repeated fragment with the same colors and scopes once', () => {
      // Arrange
      const pieces = [{ content: 'x', offset: 0, color: '#acb2be', scopes: ['s'] }, { content: 'x', offset: 1, color: '#acb2be', scopes: ['s'] }]
      const zed = [{ color: '#dfc184', capture: 'constant' }, { color: '#dfc184', capture: 'constant' }]

      // Act
      const mismatches = diffColors({ language: 'typescript', code: 'xx', pieces, winners: ['default', 'default'], zed })

      // Assert
      assertEquals(mismatches.length, 1)
    })

    it('lists a repeated fragment again when Zed colors it differently there', () => {
      // Arrange
      const pieces = [{ content: 'x', offset: 0, color: '#acb2be', scopes: ['s'] }, { content: 'x', offset: 1, color: '#acb2be', scopes: ['s'] }]
      const zed = [{ color: '#dfc184', capture: 'constant' }, { color: '#73ade9', capture: 'function' }]

      // Act
      const mismatches = diffColors({ language: 'typescript', code: 'xx', pieces, winners: ['default', 'default'], zed })

      // Assert
      assertEquals(mismatches.map((mismatch) => mismatch.capture), ['constant', 'function'])
    })
  })

  describe('toRows', () => {
    it('shows the innermost three scopes', () => {
      // Act
      const rows = toRows([mismatch])

      // Assert
      assertEquals(rows, [{
        language: 'json',
        fragment: 'true',
        ours: '#dfc184',
        selector: 'constant',
        zed: '#bf956a',
        capture: 'boolean',
        scopes: 'meta.structure.dictionary.value.json > constant.language.json > extra.scope',
      }])
    })
  })

  describe('summarize', () => {
    it('counts mismatches per language, including a language with none', () => {
      // Act
      const summary = summarize(['html', 'json'], [mismatch, mismatch])

      // Assert
      assertEquals(summary, '2 mismatches (html 0, json 2)')
    })
  })
})
