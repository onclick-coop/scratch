import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseSessions, selectSession } from './sessions.ts'

const section = (procs: unknown): string => JSON.stringify({ procs })

const SAMPLE = section({
  sessions: {
    dev: { config: 'mprocs.dev.yaml', logDir: '.mprocs' },
    ops: { config: 'mprocs.ops.yaml' },
  },
  defaultSession: 'dev',
})

describe('All Procs Sessions Tests', () => {
  describe('parseSessions', () => {
    it('reads each session with its config and log directory', () => {
      // Act
      const config = parseSessions(SAMPLE)

      // Assert
      assertEquals(config, {
        sessions: {
          dev: { config: 'mprocs.dev.yaml', logDir: '.mprocs' },
          ops: { config: 'mprocs.ops.yaml' },
        },
        defaultSession: 'dev',
      })
    })

    it('reads the empty config an absent tools.config.json reads as, giving no sessions', () => {
      // Act
      const config = parseSessions('{}')

      // Assert
      assertEquals(config, { sessions: {} })
    })

    it('reads an absent procs section as no sessions', () => {
      // Act
      const config = parseSessions('{ "commit": {} }')

      // Assert
      assertEquals(config, { sessions: {} })
    })

    it('refuses a misspelled session key rather than reading the session as having no log directory', () => {
      // Arrange
      const text = section({ sessions: { dev: { config: 'mprocs.yaml', log_dir: '.mprocs' } } })

      // Act & Assert
      assertThrows(() => parseSessions(text), CliError, 'Unrecognized key: "log_dir"')
    })

    it('refuses a misspelled top-level key rather than reading the section as having no default', () => {
      // Arrange
      const text = section({ sessions: { dev: { config: 'mprocs.yaml' } }, default_session: 'dev' })

      // Act & Assert
      assertThrows(() => parseSessions(text), CliError, 'Unrecognized key: "default_session"')
    })

    it('refuses a session that names no mprocs config', () => {
      // Act & Assert
      assertThrows(() => parseSessions(section({ sessions: { dev: { logDir: '.mprocs' } } })), CliError, 'cannot read')
    })

    it('refuses an empty mprocs config path, which would resolve to the project directory itself', () => {
      // Act & Assert
      assertThrows(() => parseSessions(section({ sessions: { dev: { config: '' } } })), CliError, 'cannot read')
    })

    it('refuses a defaultSession that names no configured session', () => {
      // Arrange
      const text = section({ sessions: { dev: { config: 'mprocs.yaml' } }, defaultSession: 'ops' })

      // Act & Assert
      assertThrows(() => parseSessions(text), CliError, 'defaultSession names no session')
    })
  })

  describe('selectSession', () => {
    it('picks the session the flag names', () => {
      // Act
      const session = selectSession(parseSessions(SAMPLE), 'ops')

      // Assert
      assertEquals(session, { name: 'ops', config: 'mprocs.ops.yaml', logDir: undefined })
    })

    it('falls back to the defaultSession when no flag is given', () => {
      // Act
      const session = selectSession(parseSessions(SAMPLE), undefined)

      // Assert
      assertEquals(session, { name: 'dev', config: 'mprocs.dev.yaml', logDir: '.mprocs' })
    })

    it('refuses an unknown session, naming the valid ones', () => {
      // Act
      const error = assertThrows(() => selectSession(parseSessions(SAMPLE), 'git'), CliError, 'Unknown session: "git"')

      // Assert
      assertEquals(error.suggestions, ['Valid sessions: dev, ops'])
    })

    it('refuses an empty session flag as an unknown session rather than falling back to the default', () => {
      // Act & Assert
      assertThrows(() => selectSession(parseSessions(SAMPLE), ''), CliError, 'Unknown session: ""')
    })

    it('refuses a session name that only an inherited property carries', () => {
      // Act & Assert
      assertThrows(() => selectSession(parseSessions(SAMPLE), 'constructor'), CliError, 'Unknown session')
    })

    it('refuses to guess a session when neither the flag nor the config names one', () => {
      // Arrange
      const config = parseSessions(section({ sessions: { dev: { config: 'mprocs.yaml' } } }))

      // Act & Assert
      assertThrows(() => selectSession(config, undefined), CliError, 'No session named')
    })

    it('refuses to run with no sessions configured, showing the shape to add', () => {
      // Act & Assert
      assertThrows(() => selectSession(parseSessions('{}'), 'dev'), CliError, 'configures no procs sessions')
    })
  })
})
