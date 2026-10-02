import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseConfig, resolveUrl, trailingSlashPattern } from './config.ts'

const section = (trpc: unknown): string => JSON.stringify({ trpc })

describe('All Trpc Config Tests', () => {
  describe('parseConfig', () => {
    it('reads every setting a project gives', () => {
      // Arrange
      const text = section({
        url: 'http://localhost:3002/trpc',
        transformer: 'superjson',
        auth: { header: 'x-token', prefix: '' },
        session: { procedures: ['account.login'], tokenPath: 'session.access_token' },
      })

      // Act
      const config = parseConfig(text)

      // Assert
      assertEquals(config, {
        url: 'http://localhost:3002/trpc',
        transformer: 'superjson',
        auth: { header: 'x-token', prefix: '' },
        session: { procedures: ['account.login'], tokenPath: 'session.access_token' },
      })
    })

    it('reads an absent section as no url, no transformer, and a bearer authorization header', () => {
      // Act
      const config = parseConfig('{}')

      // Assert
      assertEquals(config, { transformer: 'none', auth: { header: 'authorization', prefix: 'Bearer ' } })
    })

    it('fills the auth field a project leaves out with its default', () => {
      // Act
      const config = parseConfig(section({ auth: { prefix: '' } }))

      // Assert
      assertEquals(config.auth, { header: 'authorization', prefix: '' })
    })

    it('refuses a misspelled key rather than reading the section as having no session', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ sessions: { procedures: ['login'], tokenPath: 'token' } })), CliError, 'Unrecognized key: "sessions"')
    })

    it('refuses a misspelled auth or session key rather than applying the default in its place', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ auth: { header: 'x-token', prefx: '' } })), CliError, 'Unrecognized key: "prefx"')
      assertThrows(() => parseConfig(section({ session: { procedures: ['login'], tokenpath: 'token' } })), CliError, 'Unrecognized key: "tokenpath"')
    })

    it('refuses a transformer the tool cannot encode with', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ transformer: 'devalue' })), CliError)
    })

    it('refuses a session naming no procedure, which could never save a token', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ session: { procedures: [], tokenPath: 'token' } })), CliError)
    })

    it('refuses a url that is not one', () => {
      // Act & Assert
      assertThrows(() => parseConfig(section({ url: 'localhost:3002' })), CliError)
    })
  })

  describe('resolveUrl', () => {
    it('takes the url from the config when no flag is given', () => {
      // Act & Assert
      assertEquals(resolveUrl(parseConfig(section({ url: 'http://localhost:3002/trpc' })), undefined), 'http://localhost:3002/trpc')
    })

    it('takes the flag over the config', () => {
      // Act & Assert
      assertEquals(resolveUrl(parseConfig(section({ url: 'http://localhost:3002/trpc' })), 'https://api.example.com/trpc'), 'https://api.example.com/trpc')
    })

    it('drops a trailing slash, so both spellings of one address key the same saved token', () => {
      // Act & Assert
      assertEquals(resolveUrl(parseConfig(section({ url: 'http://localhost:3002/trpc/' })), undefined), 'http://localhost:3002/trpc')
      assertEquals(resolveUrl(parseConfig('{}'), 'http://localhost:3002/trpc//'), 'http://localhost:3002/trpc')
    })

    it('refuses a run with no url in either place', () => {
      // Act & Assert
      assertThrows(() => resolveUrl(parseConfig('{}'), undefined), CliError, 'No server url')
    })

    it('refuses a flag that is not a url, including the empty value a bare flag leaves', () => {
      // Act & Assert
      assertThrows(() => resolveUrl(parseConfig('{}'), 'localhost:3002'), CliError, 'Invalid --url')
      assertThrows(() => resolveUrl(parseConfig('{}'), ''), CliError, 'Invalid --url')
    })
  })

  describe('trailingSlashPattern', () => {
    it('matches one or more slashes at the end', () => {
      // Act & Assert
      assertEquals(trailingSlashPattern.test('http://a/trpc/'), true)
      assertEquals(trailingSlashPattern.test('http://a/trpc//'), true)
    })

    it('refuses a slash inside the path, which would cut the url short', () => {
      // Act & Assert
      assertEquals(trailingSlashPattern.test('http://a/trpc'), false)
      assertEquals(trailingSlashPattern.test('http://a/trpc/\n'), false)
    })
  })
})
