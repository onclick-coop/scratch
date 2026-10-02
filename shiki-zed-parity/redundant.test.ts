import { assert, assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import {
  candidateRows,
  collectScopes,
  countChanged,
  countWins,
  fallbacksFor,
  isEmitted,
  labelCharacters,
  listSelectors,
  removeRule,
  removeSelector,
  tagRules,
  type ThemeRule,
  toCharacters,
  whitespacePattern,
  wholeRuleRows,
} from './redundant.ts'

const rules: ThemeRule[] = [
  { settings: { foreground: '#acb2be' } },
  { scope: ['keyword', 'storage'], settings: { foreground: '#B477CF' } },
  { scope: 'string, punctuation.definition.string', settings: { foreground: '#a1c181' } },
]

describe('All Zed Parity Redundant Tests', () => {
  describe('listSelectors', () => {
    it('lists each selector with its rule, splitting a comma-separated scope and skipping the default rule', () => {
      // Act
      const selectors = listSelectors(rules)

      // Assert
      assertEquals(selectors, [
        { rule: 1, selector: 'keyword', color: '#b477cf' },
        { rule: 1, selector: 'storage', color: '#b477cf' },
        { rule: 2, selector: 'string', color: '#a1c181' },
        { rule: 2, selector: 'punctuation.definition.string', color: '#a1c181' },
      ])
    })
  })

  describe('removeSelector', () => {
    it('drops one selector and keeps the rest of its rule', () => {
      // Act
      const kept = removeSelector(rules, { rule: 1, selector: 'storage', color: '#b477cf' })

      // Assert
      assertEquals(kept.at(1), { scope: ['keyword'], settings: { foreground: '#B477CF' } })
    })

    it('drops a rule left with no selector, since an empty scope would read as the default rule', () => {
      // Act
      const kept = removeSelector([{ scope: ['comment'], settings: { foreground: '#5d636f' } }], { rule: 0, selector: 'comment', color: '#5d636f' })

      // Assert
      assertEquals(kept, [])
    })
  })

  describe('removeRule', () => {
    it('drops the one whole rule at the index, keeping the others in order', () => {
      // Act
      const kept = removeRule(rules, 1)

      // Assert
      assertEquals(kept, [
        { settings: { foreground: '#acb2be' } },
        { scope: 'string, punctuation.definition.string', settings: { foreground: '#a1c181' } },
      ])
    })
  })

  describe('tagRules', () => {
    it('gives every selector its own rule and color, in order, and labels the default rule', () => {
      // Act
      const tagged = tagRules(rules)

      // Assert
      assertEquals(tagged, {
        fg: '#000001',
        rules: [
          { settings: { foreground: '#000001' } },
          { scope: ['keyword'], settings: { foreground: '#000002' } },
          { scope: ['storage'], settings: { foreground: '#000003' } },
          { scope: ['string'], settings: { foreground: '#000004' } },
          { scope: ['punctuation.definition.string'], settings: { foreground: '#000005' } },
        ],
        labels: { '#000001': 'default', '#000002': 'keyword', '#000003': 'storage', '#000004': 'string', '#000005': 'punctuation.definition.string' },
      })
    })

    it('adds a default rule when the theme has none', () => {
      // Act
      const tagged = tagRules([{ scope: ['comment'], settings: { foreground: '#5d636f' } }])

      // Assert
      assertEquals(tagged.rules.at(0), { settings: { foreground: '#000002' } })
    })
  })

  describe('toCharacters', () => {
    it('spreads each token color over its characters, leaving a newline empty', () => {
      // Act
      const characters = toCharacters([[{ content: 'ab', offset: 0, color: '#B477CF' }], [{ content: 'c', offset: 3, color: '#A1C181' }]], 4)

      // Assert
      assertEquals(characters, ['#b477cf', '#b477cf', '', '#a1c181'])
    })
  })

  describe('labelCharacters', () => {
    it('reads sentinel colors back as selector labels', () => {
      // Act & Assert
      assertEquals(labelCharacters(['#000002', '#0000ff'], { '#000002': 'keyword' }), ['keyword', '-'])
    })
  })

  describe('countChanged', () => {
    it('counts visible characters whose color differs, ignoring whitespace', () => {
      // Act & Assert
      assertEquals(countChanged({ code: 'a b', before: ['#1', '#1', '#1'], after: ['#2', '#2', '#1'] }), 1)
    })
  })

  describe('countWins', () => {
    it('counts the visible characters a selector wins', () => {
      // Act & Assert
      assertEquals(countWins({ code: 'if x', winners: ['keyword', 'keyword', 'keyword', 'default'], label: 'keyword' }), 2)
    })
  })

  describe('fallbacksFor', () => {
    it('lists the selectors that take over the characters the removed selector won', () => {
      // Act
      const fallback = fallbacksFor({ code: 'ifx', winners: ['keyword.control', 'keyword.control', 'default'], fallback: ['keyword', 'keyword', 'default'], label: 'keyword.control' })

      // Assert
      assertEquals(fallback, ['keyword'])
    })

    it('skips whitespace the removed selector won, whatever takes it over', () => {
      // Act
      const fallback = fallbacksFor({ code: 'a b', winners: ['string', 'string', 'string'], fallback: ['default', 'comment', 'default'], label: 'string' })

      // Assert
      assertEquals(fallback, ['default'])
    })

    it('lists several fallbacks once each, in sorted order', () => {
      // Act
      const fallback = fallbacksFor({ code: 'abc', winners: ['string', 'string', 'string'], fallback: ['support', 'default', 'support'], label: 'string' })

      // Assert
      assertEquals(fallback, ['default', 'support'])
    })
  })

  describe('collectScopes', () => {
    it('collects every rule name and contentName, splitting names that hold several scopes', () => {
      // Arrange
      const grammar = [{ patterns: [{ name: 'string.quoted.double.ts', contentName: 'meta.embedded source.css' }], repository: { a: { name: 'keyword.control.ts' } } }]

      // Act & Assert
      assertEquals([...collectScopes(grammar)].sort(), ['keyword.control.ts', 'meta.embedded', 'source.css', 'string.quoted.double.ts'])
    })

    it("collects a grammar's root scope and leaves out its name, which is a language id", () => {
      // Arrange
      const grammar = [{ name: 'shellscript', scopeName: 'source.shell', patterns: [{ name: 'comment.line.number-sign.shell' }] }]

      // Act & Assert
      assertEquals([...collectScopes(grammar)].sort(), ['comment.line.number-sign.shell', 'source.shell'])
    })
  })

  describe('isEmitted', () => {
    it('matches a selector whose innermost part prefixes an emitted scope', () => {
      // Act & Assert
      assert(isEmitted('meta.function-call entity.name.function', new Set(['entity.name.function.ts'])))
    })

    it('matches a selector part against a segment a capture fills', () => {
      // Act & Assert
      assert(isEmitted('keyword.operator.logical.not.media', new Set(['keyword.operator.logical.$1.media.css'])))
    })

    it('refuses a selector no scope falls under, including one sharing only a text prefix', () => {
      // Act & Assert
      assert(!isEmitted('entity.name.class', new Set(['entity.name.classes.ts', 'entity.name.type.class.ts'])))
    })
  })

  describe('candidateRows', () => {
    it('names why each candidate changed nothing, with dead selectors outranking sample findings', () => {
      // Arrange
      const candidates = [
        { selector: 'entity.name.class', color: '#6eb4bf', wins: 3, fallback: ['entity.name'], emitted: false },
        { selector: 'support.class', color: '#6eb4bf', wins: 0, fallback: [], emitted: true },
        { selector: 'keyword.control', color: '#b477cf', wins: 164, fallback: ['keyword'], emitted: true },
      ]

      // Act & Assert
      assertEquals(candidateRows(candidates), [
        { selector: 'entity.name.class', color: '#6eb4bf', reason: 'emitted by no grammar', wins: 3, fallback: 'entity.name' },
        { selector: 'support.class', color: '#6eb4bf', reason: 'wins no sample character', wins: 0, fallback: '-' },
        { selector: 'keyword.control', color: '#b477cf', reason: 'shadowed by a same-color selector', wins: 164, fallback: 'keyword' },
      ])
    })
  })

  describe('wholeRuleRows', () => {
    it('names each removable rule by its selectors and color', () => {
      // Act
      const rows = wholeRuleRows(listSelectors(rules), [2])

      // Assert
      assertEquals(rows, [{ selectors: 'string, punctuation.definition.string', color: '#a1c181' }])
    })
  })

  describe('whitespacePattern', () => {
    it('matches a run of spaces, tabs, and newlines as one separator', () => {
      // Act & Assert
      assertEquals('a  b\t\nc'.split(whitespacePattern), ['a', 'b', 'c'])
    })

    it('refuses a dot, which joins the segments of one scope', () => {
      // Act & Assert
      assertEquals('a.b'.split(whitespacePattern), ['a.b'])
    })
  })
})
