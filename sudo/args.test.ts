import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { parseInvocation } from './args.ts'

describe('All Sudo Args Tests', () => {
  describe('parseInvocation', () => {
    it('passes a command and its flags through unchanged', () => {
      // Act & Assert
      assertEquals(parseInvocation(['ls', '-la']).command, ['ls', '-la'])
    })

    it("keeps the command's own -- in place", () => {
      // Act & Assert
      assertEquals(parseInvocation(['rm', '--', '-rf', '/x']).command, ['rm', '--', '-rf', '/x'])
      assertEquals(parseInvocation(['grep', '--', '-v', 'f']).command, ['grep', '--', '-v', 'f'])
    })

    it("keeps the command's own -- when it comes last", () => {
      // Act & Assert
      assertEquals(parseInvocation(['echo', '--']).command, ['echo', '--'])
      assertEquals(parseInvocation(['echo', 'a', '--']).command, ['echo', 'a', '--'])
    })

    it('keeps numeric words as written', () => {
      // Act & Assert
      assertEquals(parseInvocation(['chmod', '0755', 'f']).command, ['chmod', '0755', 'f'])
    })

    it('reads a leading -- as the end of the tool flags rather than part of the command', () => {
      // Act & Assert
      assertEquals(parseInvocation(['--', 'ls', '-la']).command, ['ls', '-la'])
    })

    it('reads --help and -h before the command as a request for usage', () => {
      // Act & Assert
      assertEquals(parseInvocation(['--help']), { help: true, unknownFlags: [], command: [] })
      assertEquals(parseInvocation(['-h']).help, true)
    })

    it('leaves a --help after the command to the command', () => {
      // Act
      const invocation = parseInvocation(['ls', '--help'])

      // Assert
      assertEquals(invocation, { help: false, unknownFlags: [], command: ['ls', '--help'] })
    })

    it('names a flag before the command that the tool does not take, including the -A it passes itself', () => {
      // Act & Assert
      assertEquals(parseInvocation(['--bogus', 'ls']).unknownFlags, ['--bogus'])
      assertEquals(parseInvocation(['-A', 'ls']).unknownFlags, ['-A'])
    })

    it('reads no command from an empty argument list or a lone --', () => {
      // Act & Assert
      assertEquals(parseInvocation([]).command, [])
      assertEquals(parseInvocation(['--']).command, [])
    })
  })
})
