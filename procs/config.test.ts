import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseProcNames, parseServerPort, portPattern, procLogPath, tailLines } from './config.ts'

const SAMPLE = [
  'hide_keymap_window: true',
  'proc_list_title: dev',
  'server: 127.0.0.1:4050',
  '',
  'procs:',
  '  client:',
  '    shell: "deno task dev"',
  '  cloudflared:',
  '    shell: "cloudflared tunnel"',
].join('\n')

const withServer = (address: string): string => {
  const lines = ['procs:', '  client:', '    shell: "deno task dev"', `server: ${address}`]

  return lines.join('\n')
}

describe('All Procs Config Tests', () => {
  describe('portPattern', () => {
    it('matches a plain run of digits', () => {
      // Act & Assert
      assertEquals(portPattern.test('4050'), true)
    })

    it('refuses a hex or exponent literal, which Number would otherwise read as a whole number', () => {
      // Act & Assert
      assertEquals(portPattern.test('0x1000'), false)
      assertEquals(portPattern.test('1e3'), false)
    })

    it('refuses a newline, which a bare anchor pair would otherwise admit', () => {
      // Act & Assert
      assertEquals(portPattern.test('4050\n'), false)
    })
  })

  describe('parseProcNames', () => {
    it('reads the proc names in the order the config declares them', () => {
      // Act
      const names = parseProcNames(SAMPLE)

      // Assert
      assertEquals(names, ['client', 'cloudflared'])
    })

    it('throws when the config declares no procs', () => {
      // Act & Assert
      assertThrows(() => parseProcNames('server: 127.0.0.1:4050'), CliError, 'shape the tool cannot read')
    })

    it('refuses procs written as a list rather than reading its indexes as names', () => {
      // Act & Assert
      assertThrows(() => parseProcNames('procs: [client, cloudflared]'), CliError, 'shape the tool cannot read')
    })

    it('refuses a config that is not a mapping', () => {
      // Act & Assert
      assertThrows(() => parseProcNames('just text'), CliError, 'shape the tool cannot read')
    })

    it('reads the names past a server address it cannot read, which only the actions use', () => {
      // Act & Assert
      assertEquals(parseProcNames(withServer('4050')), ['client'])
    })
  })

  describe('parseServerPort', () => {
    it('reads the control port from the server address', () => {
      // Act
      const port = parseServerPort(SAMPLE)

      // Assert
      assertEquals(port, 4050)
    })

    it('throws with the fix when the config enables no control server', () => {
      // Arrange
      const raw = ['proc_list_title: dev', 'procs:', '  client:', '    shell: "deno task dev"'].join('\n')

      // Act & Assert
      assertThrows(() => parseServerPort(raw), CliError, 'declares no control server')
    })

    it('throws when the server address carries no readable port', () => {
      // Act & Assert
      assertThrows(() => parseServerPort(withServer('127.0.0.1')), CliError, 'unreadable server address')
    })

    it('throws when the server address is not a string', () => {
      // Act & Assert
      assertThrows(() => parseServerPort(withServer('4050')), CliError, 'unreadable server address: 4050')
    })

    it('reads the highest port a socket can carry', () => {
      // Act
      const port = parseServerPort(withServer('127.0.0.1:65535'))

      // Assert
      assertEquals(port, 65535)
    })

    it('refuses a port past the highest a socket can carry', () => {
      // Act & Assert
      assertThrows(() => parseServerPort(withServer('127.0.0.1:65536')), CliError, 'unreadable server address')
    })

    it('refuses port 0, which asks the system for any free port rather than naming one', () => {
      // Act & Assert
      assertThrows(() => parseServerPort(withServer('127.0.0.1:0')), CliError, 'unreadable server address')
    })

    it('refuses a hex or exponent port rather than reading it as a number', () => {
      // Act & Assert
      assertThrows(() => parseServerPort(withServer('127.0.0.1:0x1000')), CliError, 'unreadable server address')
      assertThrows(() => parseServerPort(withServer('127.0.0.1:1e3')), CliError, 'unreadable server address')
    })

    it('refuses malformed yaml as a named error rather than a raw parser throw', () => {
      // Act & Assert
      assertThrows(() => parseServerPort('server: "unterminated'), CliError, 'Unreadable mprocs config')
    })
  })

  describe('procLogPath', () => {
    it('names the file gprocs writes for the proc under the log directory, resolved from the root', () => {
      // Act
      const path = procLogPath({ root: '/work/project', session: 'dev', logDir: '.mprocs', proc: 'edge' })

      // Assert
      assertEquals(path, '/work/project/.mprocs/edge.log')
    })

    it('takes an absolute log directory as written', () => {
      // Act
      const path = procLogPath({ root: '/work/project', session: 'dev', logDir: '/var/log/procs', proc: 'edge' })

      // Assert
      assertEquals(path, '/var/log/procs/edge.log')
    })

    it('refuses a session configured with no log directory, naming the setting to add', () => {
      // Arrange
      const input = { root: '/tmp', session: 'ops', logDir: undefined, proc: 'docker' }

      // Act
      const error = assertThrows(() => procLogPath(input), CliError, 'The ops session writes no proc logs')

      // Assert
      assertEquals(error.suggestions, ['Give the ops session a logDir in tools.config.json if gprocs runs it with --log-dir'])
    })
  })

  describe('tailLines', () => {
    it('returns the last line of a file that ends in a newline, rather than the empty string after it', () => {
      // Act
      const output = tailLines('first\nsecond\nlast\n', 1)

      // Assert
      assertEquals(output, 'last')
    })

    it('returns every line when asked for more than the file holds', () => {
      // Act
      const output = tailLines('first\nsecond\n', 10)

      // Assert
      assertEquals(output, 'first\nsecond')
    })

    it('strips the cursor codes from each line it returns', () => {
      // Act
      const output = tailLines('\x1b[2Kfirst\n\x1b[2Klast\n', 2)

      // Assert
      assertEquals(output, 'first\nlast')
    })
  })
})
