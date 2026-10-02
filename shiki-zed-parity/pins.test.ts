import { assert, assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { queriesLinkPattern, readPins, themeLinkPattern } from './pins.ts'

const themeSha = 'a3f6ef252b6de19d22a1223952fc335253163642'
const queriesSha = '250b6581b5b346855cccfb909839d47711cf910b'
const themeLink = `// https://github.com/zed-industries/zed/blob/${themeSha}/assets/themes/one/one.json`
const queriesLink = `// https://github.com/zed-industries/zed/tree/${queriesSha}/crates/grammars/src`

describe('All Zed Parity Pins Tests', () => {
  describe('readPins', () => {
    it('reads the commit each link pins', () => {
      // Act
      const pins = readPins([themeLink, queriesLink].join('\n'))

      // Assert
      assertEquals(pins, { theme: themeSha, queries: queriesSha })
    })

    it('refuses a theme missing only its queries link', () => {
      // Act & Assert
      assertThrows(() => readPins(themeLink), CliError, 'missing its one.json or crates/grammars/src link')
    })

    it('refuses a theme missing only its one.json link', () => {
      // Act & Assert
      assertThrows(() => readPins(queriesLink), CliError, 'missing its one.json or crates/grammars/src link')
    })
  })

  describe('themeLinkPattern', () => {
    it('matches the one.json permalink at a full SHA', () => {
      // Act & Assert
      assert(themeLinkPattern.test(`https://github.com/zed-industries/zed/blob/${themeSha}/assets/themes/one/one.json`))
    })

    it('refuses a link on a branch, which pins nothing', () => {
      // Act & Assert
      assert(!themeLinkPattern.test('https://github.com/zed-industries/zed/blob/main/assets/themes/one/one.json'))
    })

    it('refuses a short SHA, which could grow ambiguous as the repo grows', () => {
      // Act & Assert
      assert(!themeLinkPattern.test('https://github.com/zed-industries/zed/blob/a3f6ef2/assets/themes/one/one.json'))
    })
  })

  describe('queriesLinkPattern', () => {
    it('matches the grammars tree link at a full SHA', () => {
      // Act & Assert
      assert(queriesLinkPattern.test(`https://github.com/zed-industries/zed/tree/${queriesSha}/crates/grammars/src`))
    })

    it('refuses a short SHA, which could grow ambiguous as the repo grows', () => {
      // Act & Assert
      assert(!queriesLinkPattern.test('https://github.com/zed-industries/zed/tree/250b658/crates/grammars/src'))
    })

    it('refuses a link on a branch, which pins nothing', () => {
      // Act & Assert
      assert(!queriesLinkPattern.test('https://github.com/zed-industries/zed/tree/main/crates/grammars/src'))
    })
  })
})
