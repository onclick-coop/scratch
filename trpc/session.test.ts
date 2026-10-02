import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { authHeaders, parseSessions, tokenAt } from './session.ts'

const PATH = '/home/someone/.trpc/sessions.json'
const BEARER = { header: 'authorization', prefix: 'Bearer ' }

describe('All Trpc Session Tests', () => {
  describe('parseSessions', () => {
    it('reads each saved token keyed by its url', () => {
      // Arrange
      const text = JSON.stringify({ 'http://localhost:3002/trpc': { token: 'abc' } })

      // Act
      const sessions = parseSessions(text, PATH)

      // Assert
      assertEquals(sessions, { 'http://localhost:3002/trpc': { token: 'abc' } })
    })

    it('refuses a file that is not JSON rather than signing out of every server unasked', () => {
      // Act & Assert
      assertThrows(() => parseSessions('{', PATH), CliError, PATH)
    })

    it('refuses an entry that is not an object holding a token', () => {
      // Act & Assert
      assertThrows(() => parseSessions(JSON.stringify({ accessToken: 'abc', email: 'a@b.c' }), PATH), CliError)
    })
  })

  describe('authHeaders', () => {
    it('sends the token saved for the url in the configured header, after the prefix', () => {
      // Act
      const headers = authHeaders({ sessions: { 'http://a/trpc': { token: 'abc' } }, url: 'http://a/trpc', auth: BEARER })

      // Assert
      assertEquals(headers, { authorization: 'Bearer abc' })
    })

    it('sends a bare token when the prefix is empty', () => {
      // Act
      const headers = authHeaders({ sessions: { 'http://a/trpc': { token: 'abc' } }, url: 'http://a/trpc', auth: { header: 'x-token', prefix: '' } })

      // Assert
      assertEquals(headers, { 'x-token': 'abc' })
    })

    it('sends nothing to a url no token was saved for, so another server never receives it', () => {
      // Act
      const headers = authHeaders({ sessions: { 'http://a/trpc': { token: 'abc' } }, url: 'http://b/trpc', auth: BEARER })

      // Assert
      assertEquals(headers, {})
    })
  })

  describe('tokenAt', () => {
    it('follows a dotted path to the token', () => {
      // Act & Assert
      assertEquals(tokenAt({ session: { access_token: 'abc', user: { id: 1 } } }, 'session.access_token'), 'abc')
    })

    it('reads a token at the top of the result', () => {
      // Act & Assert
      assertEquals(tokenAt({ token: 'abc' }, 'token'), 'abc')
    })

    it('refuses a path the result does not hold, naming it', () => {
      // Act & Assert
      assertThrows(() => tokenAt({ session: {} }, 'session.access_token'), CliError, 'session.access_token')
      assertThrows(() => tokenAt(null, 'token'), CliError)
    })

    it('refuses a path through an array or a string, which hold no named keys', () => {
      // Act & Assert
      assertThrows(() => tokenAt({ session: ['abc'] }, 'session.0'), CliError)
      assertThrows(() => tokenAt({ session: 'abc' }, 'session.length'), CliError)
    })

    it('refuses a value that is not a token, such as an object or an empty string', () => {
      // Act & Assert
      assertThrows(() => tokenAt({ session: { access_token: { value: 'abc' } } }, 'session.access_token'), CliError, 'no token')
      assertThrows(() => tokenAt({ token: '' }, 'token'), CliError, 'no token')
    })
  })
})
