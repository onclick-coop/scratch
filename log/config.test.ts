import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseConfig, resolveLogPath, suggestMissing } from './config.ts'

const section = (log: unknown): string => JSON.stringify({ log })

const SAMPLE = section({
  services: {
    server: 'server/logs/server.log',
    worker: '/var/log/worker.log',
  },
  defaultService: 'server',
})

const CONFIG = parseConfig(SAMPLE)

describe('All Log Config Tests', () => {
  describe('parseConfig', () => {
    it('reads each service with its log file, and the default', () => {
      // Act
      const config = parseConfig(SAMPLE)

      // Assert
      assertEquals(config, {
        services: {
          server: 'server/logs/server.log',
          worker: '/var/log/worker.log',
        },
        defaultService: 'server',
      })
    })

    it('reads an absent log section as no services', () => {
      // Act
      const config = parseConfig('{ "commit": {} }')

      // Assert
      assertEquals(config, { services: {} })
    })

    it('refuses a misspelled key rather than reading the section as having no default', () => {
      // Arrange
      const text = section({ services: { server: 'server.log' }, default_service: 'server' })

      // Act & Assert
      assertThrows(() => parseConfig(text), CliError, 'Unrecognized key: "default_service"')
    })

    it('refuses an empty log path, which would resolve to the project directory itself', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ services: { server: '' } })), CliError, 'log section the tool cannot read')
    })

    it('refuses an empty service name, which an empty --service would otherwise read rather than refuse', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ services: { '': 'server.log' } })), CliError, 'log section the tool cannot read')
    })

    it('refuses a service written as an object rather than a path', () => {
      // Arrange
      const text = section({ services: { server: { path: 'server.log' } } })

      // Act & Assert
      assertThrows(() => parseConfig(text), CliError, 'log section the tool cannot read')
    })

    it('refuses a defaultService that names no configured service', () => {
      // Arrange
      const text = section({ services: { server: 'server.log' }, defaultService: 'worker' })

      // Act & Assert
      assertThrows(() => parseConfig(text), CliError, 'defaultService names no service')
    })

    it('refuses a null section', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section(null)), CliError, 'log section the tool cannot read')
    })
  })

  describe('resolveLogPath', () => {
    it('reads the default service when neither flag is given', () => {
      // Act
      const path = resolveLogPath({ service: undefined, file: undefined, config: CONFIG })

      // Assert
      assertEquals(path, 'server/logs/server.log')
    })

    it('reads the named service', () => {
      // Act
      const path = resolveLogPath({ service: 'worker', file: undefined, config: CONFIG })

      // Assert
      assertEquals(path, '/var/log/worker.log')
    })

    it('returns the file unchanged, which the caller resolves from the directory deno task was called from', () => {
      // Act
      const path = resolveLogPath({ service: undefined, file: 'logs/edge.log', config: CONFIG })

      // Assert
      assertEquals(path, 'logs/edge.log')
    })

    it('reads a file with no services configured', () => {
      // Act
      const path = resolveLogPath({ service: undefined, file: 'logs/edge.log', config: { services: {} } })

      // Assert
      assertEquals(path, 'logs/edge.log')
    })

    it('refuses a service with no log file, naming the configured ones', () => {
      // Arrange
      const input = { service: 'nonesuch', file: undefined, config: CONFIG }

      // Act
      const error = assertThrows(() => resolveLogPath(input), CliError, 'Unknown service: "nonesuch"')

      // Assert
      assertEquals(error.suggestions, ['Valid services: server, worker'])
    })

    it('refuses an empty service flag rather than falling back to the default', () => {
      // Act & Assert
      assertThrows(() => resolveLogPath({ service: '', file: undefined, config: CONFIG }), CliError, 'Unknown service: ""')
    })

    it('refuses a service name that only an inherited property carries', () => {
      // Act & Assert
      assertThrows(() => resolveLogPath({ service: 'constructor', file: undefined, config: CONFIG }), CliError, 'Unknown service')
    })

    it('refuses to guess a service when neither the flag nor the config names one', () => {
      // Arrange
      const config = parseConfig(section({ services: { server: 'server.log' } }))

      // Act & Assert
      assertThrows(() => resolveLogPath({ service: undefined, file: undefined, config }), CliError, 'No service named')
    })

    it('refuses to run with no services configured, showing the shape to add', () => {
      // Arrange
      const input = { service: 'server', file: undefined, config: { services: {} } }

      // Act
      const error = assertThrows(() => resolveLogPath(input), CliError, 'configures no log services')

      // Assert
      assertEquals(error.suggestions, ['Add one as { "log": { "services": { "<name>": "<log file path>" } } }', 'Or pass --file <path>'])
    })

    it('refuses both flags together rather than leaving one unused', () => {
      // Arrange
      const input = { service: 'worker', file: 'x.log', config: CONFIG }

      // Act & Assert
      assertThrows(() => resolveLogPath(input), CliError, '--file and --service name two different logs')
    })

    it('refuses an empty file rather than resolving it to the calling directory', () => {
      // Act & Assert
      assertThrows(() => resolveLogPath({ service: undefined, file: '', config: CONFIG }), CliError, 'Empty --file value')
    })
  })

  describe('suggestMissing', () => {
    it('names the path for a file the caller chose', () => {
      // Act
      const hint = suggestMissing('x.log')

      // Assert
      assertEquals(hint, 'Check the path, which is resolved from the directory deno task was called from')
    })

    it('names the writer and the config for a service log', () => {
      // Act
      const hint = suggestMissing(undefined)

      // Assert
      assertEquals(hint, 'Start whatever writes the log, or point the service at the file it writes in tools.config.json')
    })
  })
})
