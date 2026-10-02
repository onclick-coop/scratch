import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { parseCommandLine, splitSection } from './args.ts'

describe('All Todo Args Tests', () => {
  describe('parseCommandLine', () => {
    it('keeps a positional that reads as a number exactly as written', () => {
      // Act
      const commandLine = parseCommandLine(['add', '1.50', '1e3', '0x10', '007', 'in', '2'])

      // Assert
      assertEquals(commandLine.positionals, ['add', '1.50', '1e3', '0x10', '007', 'in', '2'])
    })

    it('reads every word after `--` as a positional, dashes included', () => {
      // Act
      const commandLine = parseCommandLine(['--', 'add', '-x flag', 'in', 'cli'])

      // Assert
      assertEquals(commandLine, { help: false, positionals: ['add', '-x flag', 'in', 'cli'], unknownFlags: [] })
    })

    it('reads -h and --help as help', () => {
      // Act & Assert
      assertEquals(parseCommandLine(['-h']).help, true)
      assertEquals(parseCommandLine(['list', '--help']).help, true)
    })

    it('names a long flag the tool does not declare with two dashes, rather than absorbing it', () => {
      // Act
      const commandLine = parseCommandLine(['list', '--foo=bar'])

      // Assert
      assertEquals(commandLine, { help: false, positionals: ['list'], unknownFlags: ['--foo'] })
    })

    it('names a short flag with one dash, and each letter of a group on its own', () => {
      // Act & Assert
      assertEquals(parseCommandLine(['-x']).unknownFlags, ['-x'])
      assertEquals(parseCommandLine(['-xy']).unknownFlags, ['-x', '-y'])
    })

    it('names an unknown flag beside --help, so help cannot hide it', () => {
      // Act
      const commandLine = parseCommandLine(['--foo', '--help'])

      // Assert
      assertEquals([commandLine.help, commandLine.unknownFlags], [true, ['--foo']])
    })

    it('names a negative number as a flag, since the parser reads a leading dash that way', () => {
      // Act
      const commandLine = parseCommandLine(['check', '-1'])

      // Assert
      assertEquals(commandLine.unknownFlags, ['-1'])
    })
  })

  describe('splitSection', () => {
    it('splits the words after `in` off as the section name', () => {
      // Act
      const result = splitSection(['buy', 'milk', 'in', 'groceries'])

      // Assert
      assertEquals(result, { words: ['buy', 'milk'], section: 'groceries', sectionWordCount: 1 })
    })

    it('joins a section name of several words with spaces and counts them', () => {
      // Act
      const result = splitSection(['0,2', 'in', 'next', 'release'])

      // Assert
      assertEquals(result, { words: ['0,2'], section: 'next release', sectionWordCount: 2 })
    })

    it('counts a quoted section name as one word', () => {
      // Act
      const result = splitSection(['x', 'in', 'sign in flow'])

      // Assert
      assertEquals(result, { words: ['x'], section: 'sign in flow', sectionWordCount: 1 })
    })

    it('splits at the last `in`, so an item may carry the word itself', () => {
      // Act
      const result = splitSection(['log', 'in', 'once', 'in', 'auth'])

      // Assert
      assertEquals(result, { words: ['log', 'in', 'once'], section: 'auth', sectionWordCount: 1 })
    })

    it('names no section when no `in` is given', () => {
      // Act
      const result = splitSection(['buy', 'milk'])

      // Assert
      assertEquals(result, { words: ['buy', 'milk'], section: null, sectionWordCount: 0 })
    })

    it('reads a trailing `in` with nothing after it as part of the item', () => {
      // Act
      const result = splitSection(['check', 'in'])

      // Assert
      assertEquals(result, { words: ['check', 'in'], section: null, sectionWordCount: 0 })
    })

    it('keeps a trailing `in` as text when an earlier `in` comes before other words', () => {
      // Act
      const result = splitSection(['0', 'in', 'check', 'in'])

      // Assert
      assertEquals(result, { words: ['0', 'in', 'check', 'in'], section: null, sectionWordCount: 0 })
    })

    it('reads a final `in` after another as a section named `in`', () => {
      // Act
      const result = splitSection(['x', 'in', 'in'])

      // Assert
      assertEquals(result, { words: ['x'], section: 'in', sectionWordCount: 1 })
    })

    it('matches `in` only as a whole word', () => {
      // Act
      const result = splitSection(['login', 'inside'])

      // Assert
      assertEquals(result, { words: ['login', 'inside'], section: null, sectionWordCount: 0 })
    })
  })
})
