import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parsePort, toCommand } from './args.ts'

describe('All Playwright Debug Args Tests', () => {
  describe('toCommand', () => {
    it('reads spawn', () => {
      // Act
      const command = toCommand({ positionals: ['spawn'], unknownFlags: [], hasUrl: true })

      // Assert
      assertEquals(command, { name: 'spawn' })
    })

    it('reads attach and the driver path after it', () => {
      // Act
      const command = toCommand({ positionals: ['attach', 'drivers/check.ts'], unknownFlags: [], hasUrl: false })

      // Assert
      assertEquals(command, { name: 'attach', driver: 'drivers/check.ts' })
    })

    it('refuses a run naming no command rather than spawning, listing the commands', () => {
      // Act
      const error = assertThrows(() => toCommand({ positionals: [], unknownFlags: [], hasUrl: false }), CliError, 'Unknown command: ""')

      // Assert
      assertEquals(error.suggestions, ['Valid commands: spawn, attach', 'Run with --help for usage'])
    })

    it('names an unknown flag ahead of the missing command', () => {
      // Act & Assert
      assertThrows(() => toCommand({ positionals: [], unknownFlags: ['prot'], hasUrl: false }), CliError, 'Unknown option: "--prot"')
    })

    it('refuses an unknown command', () => {
      // Act & Assert
      assertThrows(() => toCommand({ positionals: ['launch'], unknownFlags: [], hasUrl: false }), CliError, 'Unknown command: "launch"')
    })

    it('refuses a port written after spawn, which the port flag now carries', () => {
      // Act & Assert
      assertThrows(() => toCommand({ positionals: ['spawn', '9223'], unknownFlags: [], hasUrl: false }), CliError, 'The spawn command takes no argument')
    })

    it('refuses a second argument after the driver path', () => {
      // Act & Assert
      assertThrows(() => toCommand({ positionals: ['attach', 'check.ts', '9223'], unknownFlags: [], hasUrl: false }), CliError, 'Unexpected argument: "9223"')
    })

    it('refuses attach with no driver path', () => {
      // Act & Assert
      assertThrows(() => toCommand({ positionals: ['attach'], unknownFlags: [], hasUrl: false }), CliError, 'No driver to run')
    })

    it('refuses --url on attach, where no page is opened', () => {
      // Act & Assert
      assertThrows(() => toCommand({ positionals: ['attach', 'check.ts'], unknownFlags: [], hasUrl: true }), CliError, 'The attach command takes no --url')
    })
  })

  describe('parsePort', () => {
    it('reads a port', () => {
      // Act & Assert
      assertEquals(parsePort('9223'), 9223)
    })

    it('falls back to 9222 when the flag is absent', () => {
      // Act & Assert
      assertEquals(parsePort(undefined), 9222)
    })

    it('reads the bounds of the port range', () => {
      // Act & Assert
      assertEquals(parsePort('1'), 1)
      assertEquals(parsePort('65535'), 65535)
    })

    it('refuses zero and a port past the range', () => {
      // Act & Assert
      assertThrows(() => parsePort('0'), CliError, 'Invalid --port value: "0"')
      assertThrows(() => parsePort('65536'), CliError, 'Invalid --port value: "65536"')
    })

    it('refuses a word rather than falling back to the default port', () => {
      // Act & Assert
      assertThrows(() => parsePort('chrome'), CliError, 'Invalid --port value: "chrome"')
    })

    it('refuses the empty value a bare flag leaves, and a hex literal', () => {
      // Act & Assert
      assertThrows(() => parsePort(''), CliError, 'Invalid --port value: ""')
      assertThrows(() => parsePort('0x2406'), CliError, 'Invalid --port value: "0x2406"')
    })
  })
})
