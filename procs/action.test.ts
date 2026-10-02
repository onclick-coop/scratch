import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { assertProcName, buildCommand, isAction, newlinePattern } from './action.ts'

describe('All Procs Action Tests', () => {
  describe('newlinePattern', () => {
    it('matches a line feed and a carriage return, either of which would end the yaml line', () => {
      // Act & Assert
      assertEquals(newlinePattern.test('client\nkill-proc'), true)
      assertEquals(newlinePattern.test('client\rkill-proc'), true)
      assertEquals(newlinePattern.test('client\r\n'), true)
    })

    it('refuses a name on one line, colons, spaces, quotes, and tabs included', () => {
      // Act & Assert
      assertEquals(newlinePattern.test('fly: update-secrets'), false)
      assertEquals(newlinePattern.test('say "hi"'), false)
      assertEquals(newlinePattern.test('a\tb'), false)
    })
  })

  describe('buildCommand', () => {
    it('names the proc on the action so no selection step stands between target and effect', () => {
      // Act
      const command = buildCommand('restart', 'cloudflared')

      // Assert
      assertEquals(command, '{c: restart-proc, name: "cloudflared"}')
    })

    it('maps stop to the term-proc command gprocs understands', () => {
      // Act
      const command = buildCommand('stop', 'client')

      // Assert
      assertEquals(command, '{c: term-proc, name: "client"}')
    })

    it('maps each remaining action to its gprocs command', () => {
      // Act & Assert
      assertEquals(buildCommand('force-restart', 'edge'), '{c: force-restart-proc, name: "edge"}')
      assertEquals(buildCommand('start', 'edge'), '{c: start-proc, name: "edge"}')
      assertEquals(buildCommand('kill', 'edge'), '{c: kill-proc, name: "edge"}')
    })

    it('quotes a name whose colon would otherwise close the mapping key', () => {
      // Act
      const command = buildCommand('stop', 'fly: update-secrets')

      // Assert
      assertEquals(command, '{c: term-proc, name: "fly: update-secrets"}')
    })

    it('escapes a quote inside a name rather than ending the scalar early', () => {
      // Act
      const command = buildCommand('restart', 'say "hi"')

      // Assert
      assertEquals(command, '{c: restart-proc, name: "say \\"hi\\""}')
    })

    it('escapes a backslash inside a name before the quotes, so it cannot escape the closing quote', () => {
      // Act
      const command = buildCommand('restart', 'dir\\')

      // Assert
      assertEquals(command, '{c: restart-proc, name: "dir\\\\"}')
    })

    it('escapes a backslash ahead of a quote as two escapes rather than one', () => {
      // Act
      const command = buildCommand('restart', 'a\\"b')

      // Assert
      assertEquals(command, '{c: restart-proc, name: "a\\\\\\"b"}')
    })

    it('refuses a name that would frame the control command as two lines', () => {
      // Act & Assert
      assertThrows(() => buildCommand('restart', 'client\nkill-proc'), CliError)
    })
  })

  describe('assertProcName', () => {
    it('accepts the names the mprocs configs use, punctuation included', () => {
      // Act & Assert
      assertProcName('cloudflared')
      assertProcName('fly-logs')
      assertProcName('fly: update-secrets')
    })

    it('rejects a name spanning two lines', () => {
      // Act & Assert
      assertThrows(() => assertProcName('client\nkill-proc'), CliError)
    })

    it('rejects an empty name', () => {
      // Act & Assert
      assertThrows(() => assertProcName(''), CliError)
    })
  })

  describe('isAction', () => {
    it('accepts a known action', () => {
      // Act & Assert
      assertEquals(isAction('restart'), true)
    })

    it('rejects an unknown action', () => {
      // Act & Assert
      assertEquals(isAction('obliterate'), false)
    })
  })
})
