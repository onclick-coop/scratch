import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from './error.utils.ts'
import { countPattern, parseCount, parseIntegerList, toInvocation } from './parse.utils.ts'

describe('All Parse Utils Tests', () => {
  describe('countPattern', () => {
    it('matches plain digits', () => {
      // Act & Assert
      assertEquals(countPattern.test('200'), true)
      assertEquals(countPattern.test('0'), true)
      assertEquals(countPattern.test('007'), true)
    })

    it('rejects a sign, which `Number` would otherwise read as a value', () => {
      // Act & Assert
      assertEquals(countPattern.test('+5'), false)
      assertEquals(countPattern.test('-5'), false)
    })

    it('rejects the literal forms `Number` reads as whole numbers', () => {
      // Act & Assert
      assertEquals(countPattern.test('0x10'), false)
      assertEquals(countPattern.test('1e3'), false)
      assertEquals(countPattern.test('1_000'), false)
    })

    it('rejects surrounding whitespace, which `Number` trims before parsing', () => {
      // Act & Assert
      assertEquals(countPattern.test(' 5'), false)
      assertEquals(countPattern.test('5 '), false)
    })

    it('rejects a decimal and a trailing word', () => {
      // Act & Assert
      assertEquals(countPattern.test('5.0'), false)
      assertEquals(countPattern.test('12abc'), false)
    })

    it('rejects an empty value, which the argument parser leaves behind after a bare flag', () => {
      // Act & Assert
      assertEquals(countPattern.test(''), false)
    })

    it('rejects a digit run carrying a newline, which the class excludes rather than anchoring out', () => {
      // Act & Assert
      assertEquals(countPattern.test('200\n'), false)
      assertEquals(countPattern.test('2\n0'), false)
    })

    it('rejects digits outside ASCII, since the class is ASCII-only', () => {
      // Act & Assert
      assertEquals(countPattern.test('٥'), false)
      assertEquals(countPattern.test('５'), false)
    })
  })

  describe('parseCount', () => {
    it('reads a plain count', () => {
      // Act & Assert
      assertEquals(parseCount('500', 200, '--lines'), 500)
    })

    it('falls back when the flag is absent', () => {
      // Act & Assert
      assertEquals(parseCount(undefined, 200, '--lines'), 200)
    })

    it('names the flag it was given, so two flags sharing the helper still report themselves', () => {
      // Act & Assert
      assertThrows(() => parseCount('nope', 200, '--depth'), CliError, '--depth')
    })

    it('refuses the empty string the argument parser leaves when a negative follows the flag', () => {
      // Act & Assert
      assertThrows(() => parseCount('', 200, '--lines'), CliError)
    })

    it('refuses a hex or exponent literal, which Number would read as a whole number', () => {
      // Act & Assert
      assertThrows(() => parseCount('0x10', 200, '--lines'), CliError)
      assertThrows(() => parseCount('1e3', 200, '--lines'), CliError)
    })

    it('refuses zero and a negative', () => {
      // Act & Assert
      assertThrows(() => parseCount('0', 200, '--lines'), CliError)
      assertThrows(() => parseCount('-5', 200, '--lines'), CliError)
    })

    it('refuses a count so large that rendering it back would reach the wrapped command as scientific notation', () => {
      // Act & Assert
      assertThrows(() => parseCount('99999999999999999999999', 200, '--lines'), CliError)
    })

    it('refuses a value padded with whitespace or carrying a sign', () => {
      // Act & Assert
      assertThrows(() => parseCount(' 5', 200, '--lines'), CliError)
      assertThrows(() => parseCount('+5', 200, '--lines'), CliError)
    })
  })

  describe('parseIntegerList', () => {
    it('reads a comma-separated list', () => {
      // Act & Assert
      assertEquals(parseIntegerList('0,2,5'), [0, 2, 5])
    })

    it('tolerates spaces around each part', () => {
      // Act & Assert
      assertEquals(parseIntegerList('0, 2 , 5'), [0, 2, 5])
    })

    it('refuses a negative or a non-integer part', () => {
      // Act & Assert
      assertThrows(() => parseIntegerList('0,-2'), CliError)
      assertThrows(() => parseIntegerList('0,two'), CliError)
    })

    it('refuses an empty part, which a trailing comma leaves behind', () => {
      // Act & Assert
      assertThrows(() => parseIntegerList('0,'), CliError)
    })
  })
  describe('toInvocation', () => {
    const commands = ['read', 'list', 'new', 'send'] as const
    const withArgument = ['new', 'send'] as const

    it('falls back to the named command when no command is given', () => {
      // Act
      const invocation = toInvocation({ positionals: [], commands, withArgument, fallback: 'read', unknownFlags: [] })

      // Assert
      assertEquals(invocation, { command: 'read', argument: undefined })
    })

    it('reads a command and its argument', () => {
      // Act
      const invocation = toInvocation({ positionals: ['send', 'echo hi'], commands, withArgument, fallback: 'read', unknownFlags: [] })

      // Assert
      assertEquals(invocation, { command: 'send', argument: 'echo hi' })
    })

    it('refuses a second argument rather than dropping it in silence', () => {
      // Act & Assert
      assertThrows(() => toInvocation({ positionals: ['new', 'one', 'two'], commands, withArgument, fallback: 'read', unknownFlags: [] }), CliError)
    })

    it('refuses an argument on a command that takes none', () => {
      // Act & Assert
      assertThrows(() => toInvocation({ positionals: ['read', 'dev'], commands, withArgument, fallback: 'read', unknownFlags: [] }), CliError)
      assertThrows(() => toInvocation({ positionals: ['list', 'dev'], commands, withArgument, fallback: 'read', unknownFlags: [] }), CliError)
    })

    it('refuses an unrecognized flag, which the parser would otherwise absorb into the fallback command', () => {
      // Act & Assert
      assertThrows(() => toInvocation({ positionals: [], commands, withArgument, fallback: 'read', unknownFlags: ['kill'] }), CliError)
    })

    it('refuses an unknown command before anything acts on it', () => {
      // Act & Assert
      assertThrows(() => toInvocation({ positionals: ['nuke'], commands, withArgument, fallback: 'read', unknownFlags: [] }), CliError)
      assertThrows(() => toInvocation({ positionals: ['READ'], commands, withArgument, fallback: 'read', unknownFlags: [] }), CliError)
    })
  })
})
