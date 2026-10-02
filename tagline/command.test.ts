import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { assignmentPattern, skipOptions, stripPrefixes } from './command.ts'
import type { Word } from './shell.ts'

const words = (...texts: string[]): Word[] => texts.map((text) => ({ text, dynamic: false }))

const textsOf = (list: Word[]): string[] => list.map((word) => word.text)

describe('All Tagline Command Tests', () => {
  describe('stripPrefixes', () => {
    it('drops assignments and reserved words before the command', () => {
      // Act & Assert
      assertEquals(textsOf(stripPrefixes(words('!', 'A=1', 'gh', 'pr', 'list'))), ['gh', 'pr', 'list'])
    })

    it('drops a wrapper with its options, the values they take, and its operands', () => {
      // Act & Assert
      assertEquals(textsOf(stripPrefixes(words('timeout', '-k', '5', '30', 'gh', 'pr', 'list'))), ['gh', 'pr', 'list'])
      assertEquals(textsOf(stripPrefixes(words('sudo', '-iu', 'root', '--', 'gh'))), ['gh'])
    })

    it('keeps a command that is not a wrapper', () => {
      // Act & Assert
      assertEquals(textsOf(stripPrefixes(words('git', 'push'))), ['git', 'push'])
    })
  })

  describe('skipOptions', () => {
    it('reads a value attached inside a cluster without taking the next word', () => {
      // Act & Assert
      assertEquals(textsOf(skipOptions(words('-uroot', 'gh'), ['-u'])), ['gh'])
    })

    it('reads the next word as the value of a cluster ending in a value-taking letter', () => {
      // Act & Assert
      assertEquals(textsOf(skipOptions(words('-iu', 'root', 'gh'), ['-u'])), ['gh'])
    })
  })

  describe('assignmentPattern', () => {
    it('matches a variable assignment and an append', () => {
      // Act & Assert
      assertEquals(assignmentPattern.test('GH_REPO=o/r'), true)
      assertEquals(assignmentPattern.test('PATH+=:/bin'), true)
    })

    it('refuses a flag carrying an equals sign, which is an argument rather than an assignment', () => {
      // Act & Assert
      assertEquals(assignmentPattern.test('--body=x'), false)
    })

    it('refuses a name starting with a digit', () => {
      // Act & Assert
      assertEquals(assignmentPattern.test('1X=y'), false)
    })
  })
})
