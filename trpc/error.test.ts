import { assertEquals, assertInstanceOf } from '@std/assert'
import { TRPCClientError } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { digitFlagPattern, redirectRefusedPattern, refusedForKind, toCliError, unknownOptionError, wrongKindPattern } from './error.ts'

const SERVER_URL = 'http://localhost:3000/trpc'

const answered = (status: number, message: string): TRPCClientError<AnyTRPCRouter> => {
  return new TRPCClientError(message, { meta: { response: new Response(null, { status }) } })
}

describe('All Trpc Error Tests', () => {
  describe('refusedForKind', () => {
    it('reads a v11 405 as a call refused for its kind', () => {
      // Act & Assert
      assertEquals(refusedForKind(answered(405, 'Unsupported POST-request to query procedure at path "me"')), true)
    })

    it("reads v10's 404 for a mutation called on a query as a call refused for its kind", () => {
      // Act & Assert
      assertEquals(refusedForKind(answered(404, 'No "mutation"-procedure on path "me"')), true)
    })

    it('reads any other 404 as the answer, so a procedure that throws NOT_FOUND is not called twice', () => {
      // Act & Assert
      assertEquals(refusedForKind(answered(404, 'Minutes not found')), false)
      assertEquals(refusedForKind(answered(404, 'No procedure found on path "nope"')), false)
    })

    it('reads a failure that is not a tRPC answer as final, whatever its message', () => {
      // Act & Assert
      assertEquals(refusedForKind(answered(500, 'boom')), false)
      assertEquals(refusedForKind(answered(500, 'No "mutation"-procedure on path "me"')), false)
      assertEquals(refusedForKind(new TypeError('fetch failed')), false)
    })
  })

  describe('toCliError', () => {
    it('names the status and message the server answered with', () => {
      // Act
      const error = toCliError(answered(400, 'Q: Required'), SERVER_URL)

      // Assert
      assertInstanceOf(error, CliError)
      assertEquals(error.message, 'tRPC error (400): Q: Required')
    })

    it('names the fix when the transformer could not decode the answer, though the answer carried a status', () => {
      // Arrange
      const cause = new Error('Unable to transform response from server')
      const meta = { response: new Response(null, { status: 200 }) }

      // Act
      const error = toCliError(new TRPCClientError('Unable to transform response from server', { cause, meta }), SERVER_URL)

      // Assert
      assertInstanceOf(error, CliError)
      assertEquals(error.message, 'The answer from http://localhost:3000/trpc could not be decoded')
    })

    it('tells an answer that is not JSON from a server that never answered', () => {
      // Arrange
      const cause = new SyntaxError('Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON')

      // Act
      const error = toCliError(new TRPCClientError(cause.message, { cause }), SERVER_URL)

      // Assert
      assertInstanceOf(error, CliError)
      assertEquals(error.message, 'The answer from http://localhost:3000/trpc is not tRPC JSON')
    })

    it('tells a refused redirect from a server that never answered', () => {
      // Arrange
      const cause = new TypeError("Fetch failed: Encountered redirect while redirect mode is set to 'error'")

      // Act
      const error = toCliError(new TRPCClientError(cause.message, { cause }), SERVER_URL)

      // Assert
      assertInstanceOf(error, CliError)
      assertEquals(error.message, 'The url http://localhost:3000/trpc redirects, which the tool does not follow')
    })

    it('reads a server error quoting the redirect refusal as the server answer it is', () => {
      // Act
      const error = toCliError(answered(500, "Fetch failed: Encountered redirect while redirect mode is set to 'error'"), SERVER_URL)

      // Assert
      assertInstanceOf(error, CliError)
      assertEquals(error.message, "tRPC error (500): Fetch failed: Encountered redirect while redirect mode is set to 'error'")
    })

    it('reads a failure with no answer as an unreachable server', () => {
      // Act
      const error = toCliError(new TRPCClientError('fetch failed', { cause: new TypeError('fetch failed') }), SERVER_URL)

      // Assert
      assertInstanceOf(error, CliError)
      assertEquals(error.message, 'Request to http://localhost:3000/trpc failed: fetch failed')
    })

    it('passes an error that is not a tRPC failure through unchanged, so a bug keeps its stack', () => {
      // Arrange
      const bug = new RangeError('out of range')

      // Act & Assert
      assertEquals(toCliError(bug, SERVER_URL), bug)
    })
  })

  describe('unknownOptionError', () => {
    it('names a long flag as typed and points at the help alone', () => {
      // Act
      const error = unknownOptionError('bogus')

      // Assert
      assertEquals(error.message, 'Unknown option: "--bogus"')
      assertEquals(error.suggestions, ['Run with --help for usage'])
    })

    it('names a single-letter flag with one dash, with no -- hint for what is a typo', () => {
      // Act
      const error = unknownOptionError('x')

      // Assert
      assertEquals(error.message, 'Unknown option: "-x"')
      assertEquals(error.suggestions, ['Run with --help for usage'])
    })

    it('adds the -- hint for the digit a negative number becomes', () => {
      // Act
      const error = unknownOptionError('1')

      // Assert
      assertEquals(error.message, 'Unknown option: "-1"')
      assertEquals(error.suggestions, ['Put -- before an input that starts with a dash, as trpc <procedure> -- -5', 'Run with --help for usage'])
    })
  })

  describe('digitFlagPattern', () => {
    it('matches a single digit', () => {
      // Act & Assert
      assertEquals(digitFlagPattern.test('1'), true)
    })

    it('refuses a letter or a word, which is a mistyped flag rather than a number', () => {
      // Act & Assert
      assertEquals(digitFlagPattern.test('x'), false)
      assertEquals(digitFlagPattern.test('1x'), false)
    })

    it('refuses a digit carrying a newline', () => {
      // Act & Assert
      assertEquals(digitFlagPattern.test('1\n'), false)
    })
  })

  describe('wrongKindPattern', () => {
    it("matches v10's refusal of a mutation on a query", () => {
      // Act & Assert
      assertEquals(wrongKindPattern.test('No "mutation"-procedure on path "me"'), true)
    })

    it('refuses the same refusal for a query, which a retry has already made', () => {
      // Act & Assert
      assertEquals(wrongKindPattern.test('No "query"-procedure on path "me"'), false)
    })

    it('refuses the refusal quoted inside a message the procedure threw', () => {
      // Act & Assert
      assertEquals(wrongKindPattern.test('Failed: No "mutation"-procedure on path "me"'), false)
    })
  })

  describe('redirectRefusedPattern', () => {
    it('matches the refusal fetch throws for a redirect', () => {
      // Act & Assert
      assertEquals(redirectRefusedPattern.test("Fetch failed: Encountered redirect while redirect mode is set to 'error'"), true)
    })

    it('refuses a failure that only mentions redirects, such as a refused connection', () => {
      // Act & Assert
      assertEquals(redirectRefusedPattern.test('Connection refused (os error 111)'), false)
      assertEquals(redirectRefusedPattern.test('too many redirects'), false)
    })
  })
})
