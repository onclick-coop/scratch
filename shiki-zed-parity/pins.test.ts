import { assert, assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { queriesLinkPattern, readPin, themeLinkPattern } from './pins.ts'

const sha = '250b6581b5b346855cccfb909839d47711cf910b'
const themeLink = `// https://github.com/zed-industries/zed/blob/${sha}/assets/themes/one/one.json`
const queriesLink = `// https://github.com/zed-industries/zed/tree/${sha}/crates/grammars/src`

describe('All Zed Parity Pins Tests', () => {
  describe('readPin', () => {
    it('reads the commit both links pin', () => {
      // Act & Assert
      assertEquals(readPin([themeLink, queriesLink].join('\n')), sha)
    })

    it('refuses links at two commits, since update reads both from one checkout', () => {
      // Arrange
      const source = [themeLink.replace(sha, 'a3f6ef252b6de19d22a1223952fc335253163642'), queriesLink].join('\n')

      // Act & Assert
      assertThrows(() => readPin(source), CliError, `links one.json at a3f6ef252b6de19d22a1223952fc335253163642 but its queries at ${sha}`)
    })

    it('refuses a theme missing only its queries link', () => {
      // Act & Assert
      assertThrows(() => readPin(themeLink), CliError, 'missing its one.json or crates/grammars/src link')
    })

    it('refuses a theme missing only its one.json link', () => {
      // Act & Assert
      assertThrows(() => readPin(queriesLink), CliError, 'missing its one.json or crates/grammars/src link')
    })
  })

  describe('themeLinkPattern', () => {
    it('matches the one.json permalink at a full SHA', () => {
      // Act & Assert
      assert(themeLinkPattern.test(`https://github.com/zed-industries/zed/blob/${sha}/assets/themes/one/one.json`))
    })

    it('refuses a link on a branch, which pins nothing', () => {
      // Act & Assert
      assert(!themeLinkPattern.test('https://github.com/zed-industries/zed/blob/main/assets/themes/one/one.json'))
    })

    it('refuses a short SHA, which could grow ambiguous as the repo grows', () => {
      // Act & Assert
      assert(!themeLinkPattern.test('https://github.com/zed-industries/zed/blob/250b658/assets/themes/one/one.json'))
    })

    it('refuses forty characters that are not hex, which no commit carries', () => {
      // Act & Assert
      assert(!themeLinkPattern.test(`https://github.com/zed-industries/zed/blob/${'z'.repeat(40)}/assets/themes/one/one.json`))
    })

    it('refuses a permalink to another theme file, which is not the palette source', () => {
      // Act & Assert
      assert(!themeLinkPattern.test(`https://github.com/zed-industries/zed/blob/${sha}/assets/themes/ayu/ayu.json`))
    })
  })

  describe('queriesLinkPattern', () => {
    it('matches the grammars tree link at a full SHA', () => {
      // Act & Assert
      assert(queriesLinkPattern.test(`https://github.com/zed-industries/zed/tree/${sha}/crates/grammars/src`))
    })

    it('refuses a short SHA, which could grow ambiguous as the repo grows', () => {
      // Act & Assert
      assert(!queriesLinkPattern.test('https://github.com/zed-industries/zed/tree/250b658/crates/grammars/src'))
    })

    it('refuses a link on a branch, which pins nothing', () => {
      // Act & Assert
      assert(!queriesLinkPattern.test('https://github.com/zed-industries/zed/tree/main/crates/grammars/src'))
    })

    it('refuses forty characters that are not hex, which no commit carries', () => {
      // Act & Assert
      assert(!queriesLinkPattern.test(`https://github.com/zed-industries/zed/tree/${'z'.repeat(40)}/crates/grammars/src`))
    })

    it('refuses a tree link to another directory, which holds no queries', () => {
      // Act & Assert
      assert(!queriesLinkPattern.test(`https://github.com/zed-industries/zed/tree/${sha}/crates/language/src`))
    })
  })
})
