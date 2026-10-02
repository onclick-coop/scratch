import { assertEquals, assertExists, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { assertArgs, type Filter, headerPattern, isLevel, matches, parseLine } from './parse.ts'

describe('All Log Parse Tests', () => {
  describe('isLevel', () => {
    it('accepts every level the filter ranks', () => {
      // Act & Assert
      assertEquals(isLevel('trace'), true)
      assertEquals(isLevel('debug'), true)
      assertEquals(isLevel('info'), true)
      assertEquals(isLevel('warn'), true)
      assertEquals(isLevel('error'), true)
      assertEquals(isLevel('fatal'), true)
    })

    it('rejects a level token rather than a level name', () => {
      // Act & Assert
      assertEquals(isLevel('WRN'), false)
      assertEquals(isLevel('warning'), false)
    })
  })

  describe('assertArgs', () => {
    const clean = { positionals: [], keys: ['_', 'help', 'h', 'no-follow'], level: undefined, cat: undefined }

    it('accepts the keys parseArgs returns for a run passing no flags', () => {
      // Act & Assert
      assertArgs(clean)
    })

    it('accepts the keys parseArgs returns for -s, -l, and -c, with a level name and a category substring', () => {
      // Arrange
      const keys = ['_', 's', 'service', 'l', 'level', 'c', 'cat', 'help', 'h', 'no-follow']

      // Act & Assert
      assertArgs({ positionals: [], keys, level: 'warn', cat: 'tarpit' })
    })

    it('accepts the keys parseArgs returns for -f', () => {
      // Act & Assert
      assertArgs({ ...clean, keys: ['_', 'file', 'f', 'help', 'h', 'no-follow'] })
    })

    it('refuses a service named as a bare word, which would otherwise read the default', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ ...clean, positionals: ['voice'] }), CliError)
    })

    it('refuses an unrecognized long flag, which the parser would otherwise absorb, naming it with two dashes', () => {
      // Arrange
      const keys = ['_', 'levle', 'help', 'h', 'no-follow']

      // Act & Assert
      assertThrows(() => assertArgs({ ...clean, keys }), CliError, 'Unknown option: "--levle"')
    })

    it('refuses an unrecognized short flag, naming it with one dash', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ ...clean, keys: ['_', 'x', 'help', 'h', 'no-follow'] }), CliError, 'Unknown option: "-x"')
    })

    it('refuses a level the filter cannot rank', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ ...clean, level: 'warning' }), CliError)
    })

    it('refuses an empty level, which parseArgs hands over when the value is another flag', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ ...clean, level: '' }), CliError)
    })

    it('refuses an empty category, which would match every line the filter was meant to narrow', () => {
      // Act & Assert
      assertThrows(() => assertArgs({ ...clean, cat: '' }), CliError)
    })
  })

  describe('headerPattern', () => {
    it('captures the level token and the category', () => {
      // Act
      const match = headerPattern.exec('04:16:47.099 WRN app\u{B7}governance\u{B7}broadcast message text')

      // Assert
      assertExists(match)
      const [, token, category] = match
      assertEquals(token, 'WRN')
      assertEquals(category, 'app\u{B7}governance\u{B7}broadcast')
    })

    it('reads across a newline, since `\\s` admits one and the reader splits lines before this sees them', () => {
      // Act
      const leading = headerPattern.exec('\n04:16:47.099 INF app x')
      const separating = headerPattern.exec('04:16:47.099 INF app\nx')

      // Assert
      assertExists(leading)
      assertExists(separating)
    })

    it('refuses a timestamp past the start of a line, which a message may merely quote', () => {
      // Act
      const match = headerPattern.exec('retrying at 04:16:47.099 INF app x')

      // Assert
      assertEquals(match, null)
    })

    it('ends the category at a tab, a carriage return, or a form feed, which `\\s` admits', () => {
      // Act
      const tab = headerPattern.exec('04:16:47.099 INF app\tx')
      const carriage = headerPattern.exec('04:16:47.099 INF app\rx')
      const feed = headerPattern.exec('04:16:47.099 INF app\fx')

      // Assert
      assertExists(tab)
      assertExists(carriage)
      assertExists(feed)
      assertEquals([tab[2], carriage[2], feed[2]], ['app', 'app', 'app'])
    })

    it('keeps a control character that is not whitespace inside the category, since `\\S` admits it', () => {
      // Act
      const bell = headerPattern.exec('04:16:47.099 INF app\u{7}x message')
      const nul = headerPattern.exec('04:16:47.099 INF app\u{0}x message')

      // Assert
      assertExists(bell)
      assertExists(nul)
      assertEquals([bell[2], nul[2]], ['app\u{7}x', 'app\u{0}x'])
    })

    it('requires the level token to be three capitals', () => {
      // Act
      const lower = headerPattern.exec('04:16:47.099 wrn app x')
      const four = headerPattern.exec('04:16:47.099 WARN app x')

      // Assert
      assertEquals(lower, null)
      assertEquals(four, null)
    })

    it('requires a message after the category', () => {
      // Act
      const bare = headerPattern.exec('04:16:47.099 INF app')
      const spaced = headerPattern.exec('04:16:47.099 INF app ')

      // Assert
      assertEquals(bare, null)
      assertExists(spaced)
      const [, , category] = spaced
      assertEquals(category, 'app')
    })

    it('requires millisecond precision on the timestamp', () => {
      // Act
      const match = headerPattern.exec('04:16:47 INF app x')

      // Assert
      assertEquals(match, null)
    })
  })

  describe('parseLine', () => {
    it('reads the level and category from a logtape header', () => {
      // Act
      const parsed = parseLine('04:16:47.099 WRN app\u{B7}governance\u{B7}broadcast\u{B7}discord-scan Active-meeting scan failed')

      // Assert
      assertEquals(parsed, { level: 'warn', category: 'app\u{B7}governance\u{B7}broadcast\u{B7}discord-scan' })
    })

    it('reads the header through colour escapes', () => {
      // Act
      const parsed = parseLine('\x1b[90m04:16:47.099\x1b[0m \x1b[31mERR\x1b[0m \x1b[36mapp\u{B7}error\x1b[0m boom')

      // Assert
      assertEquals(parsed, { level: 'error', category: 'app\u{B7}error' })
    })

    it('allows leading whitespace before the timestamp', () => {
      // Act
      const parsed = parseLine('  04:16:47.099 INF app started')

      // Assert
      assertEquals(parsed, { level: 'info', category: 'app' })
    })

    it('maps every level token', () => {
      // Act
      const levels = ['TRC', 'DBG', 'INF', 'WRN', 'ERR', 'FTL'].map((token) => parseLine(`04:16:47.099 ${token} app x`).level)

      // Assert
      assertEquals(levels, ['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    })

    it('returns no level for an unknown token that still fits the header shape', () => {
      // Act
      const parsed = parseLine('04:16:47.099 XYZ app x')

      // Assert
      assertEquals(parsed, { level: null, category: 'app' })
    })

    it('returns nothing for a line without a header', () => {
      // Act
      const parsed = parseLine('    at file:///work/project/x.ts:12:3')

      // Assert
      assertEquals(parsed, { level: null, category: null })
    })

    it('returns nothing when the timestamp has no milliseconds', () => {
      // Act
      const parsed = parseLine('04:16:47 INF app x')

      // Assert
      assertEquals(parsed, { level: null, category: null })
    })

    it('returns nothing when the header has no message after the category', () => {
      // Act
      const parsed = parseLine('04:16:47.099 INF app')

      // Assert
      assertEquals(parsed, { level: null, category: null })
    })

    it('reads the header through the cursor codes gprocs writes ahead of it', () => {
      // Act
      const parsed = parseLine('\x1b[0G\x1b[2K\x1b[J00:55:25.377 INF app\u{B7}transcribe Transcript sweep completed')

      // Assert
      assertEquals(parsed, { level: 'info', category: 'app\u{B7}transcribe' })
    })
  })

  describe('matches', () => {
    const everything: Filter = { minLevel: null, category: null }

    it('keeps a line at the filtered level', () => {
      // Act & Assert
      assertEquals(matches('04:16:47.099 ERR app boom', { minLevel: 'error', category: null }), true)
    })

    it('keeps a line above the filtered level', () => {
      // Act & Assert
      assertEquals(matches('04:16:47.099 FTL app boom', { minLevel: 'error', category: null }), true)
    })

    it('keeps an error line under a warn filter, since error ranks above warn', () => {
      // Act & Assert
      assertEquals(matches('04:16:47.099 ERR app boom', { minLevel: 'warn', category: null }), true)
    })

    it('drops a line below the filtered level', () => {
      // Act & Assert
      assertEquals(matches('04:16:47.099 INF app started', { minLevel: 'error', category: null }), false)
    })

    it('drops a line gprocs prefixed with cursor codes, which used to pass every filter unparsed', () => {
      // Arrange
      const line = '\x1b[0G\x1b[2K\x1b[J00:55:25.377 INF app\u{B7}transcribe swept'

      // Act & Assert
      assertEquals(matches(line, { minLevel: 'error', category: null }), false)
    })

    it('keeps a line whose category contains the filter', () => {
      // Act & Assert
      assertEquals(matches('04:16:47.099 INF app\u{B7}middleware\u{B7}tarpit held', { minLevel: null, category: 'tarpit' }), true)
    })

    it('keeps a line whose category holds the filter in a middle segment', () => {
      // Arrange
      const line = '04:16:47.099 INF app\u{B7}middleware\u{B7}tarpit held'

      // Act & Assert
      assertEquals(matches(line, { minLevel: null, category: 'middleware' }), true)
    })

    it('drops a line whose category does not contain the filter', () => {
      // Act & Assert
      assertEquals(matches('04:16:47.099 INF app\u{B7}request served', { minLevel: null, category: 'tarpit' }), false)
    })

    it('requires both filters to pass rather than either', () => {
      // Arrange
      const filter: Filter = { minLevel: 'warn', category: 'tarpit' }

      // Act & Assert
      assertEquals(matches('04:16:47.099 WRN app\u{B7}middleware\u{B7}tarpit held', filter), true)
      assertEquals(matches('04:16:47.099 INF app\u{B7}middleware\u{B7}tarpit held', filter), false)
      assertEquals(matches('04:16:47.099 WRN app\u{B7}request served', filter), false)
    })

    it('passes a headerless line through, so a stack trace is never silently dropped', () => {
      // Act & Assert
      assertEquals(matches('    at file:///x.ts:12:3', { minLevel: 'error', category: 'tarpit' }), true)
    })

    it('passes a line whose level token is unknown, which leaves it unranked rather than below', () => {
      // Act & Assert
      assertEquals(matches('04:16:47.099 XYZ app x', { minLevel: 'error', category: null }), true)
    })

    it('keeps every line when no filter is set', () => {
      // Act & Assert
      assertEquals(matches('04:16:47.099 TRC app x', everything), true)
      assertEquals(matches('raw watcher output', everything), true)
    })
  })
})
