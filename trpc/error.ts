import { TRPCClientError } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server'
import { CliError } from '../utils/error.utils.ts'

const UNDECODABLE_MESSAGE = 'Unable to transform response from server'

// The message v10 sends with its 404 for a mutation called on a query, where v11 answers 405.
export const wrongKindPattern = /^No "mutation"-procedure on path /

// The refusal fetch throws when a response redirects and redirect mode is `error`.
export const redirectRefusedPattern = /Encountered redirect/

// A single digit, the key the argument parser makes of a negative number such as `-12`.
export const digitFlagPattern = /^\d$/

// Only the flag a negative number turns into gets the `--` hint, which would mislead a typo.
export const unknownOptionError = (key: string): CliError => {
  const spelled = key.length === 1 ? `-${key}` : `--${key}`
  const suggestions = ['Run with --help for usage']
  if (digitFlagPattern.test(key)) suggestions.unshift('Put -- before an input that starts with a dash, as trpc <procedure> -- -5')

  return new CliError(`Unknown option: "${spelled}"`, suggestions)
}

const responseStatus = (error: TRPCClientError<AnyTRPCRouter>): number => {
  const response = error.meta?.response

  return response instanceof Response ? response.status : 0
}

// A v11 405 and a v10 wrong-kind 404 refuse the call before it runs, so a query retry is safe.
export const refusedForKind = (error: Error): boolean => {
  const isClientError = error instanceof TRPCClientError
  if (!isClientError) return false

  const status = responseStatus(error)

  return status === 405 || (status === 404 && wrongKindPattern.test(error.message))
}

// A tRPC failure becomes a CliError, naming the status when the server answered with one.
export const toCliError = (error: Error, url: string): Error => {
  const isClientError = error instanceof TRPCClientError
  if (!isClientError) return error

  // The client swaps a transformer failure for this message and drops the cause.
  if (error.cause?.message === UNDECODABLE_MESSAGE) {
    return new CliError(`The answer from ${url} could not be decoded`, [
      'Set transformer in tools.config.json to the one the server uses, superjson or none',
      'Check that the url names the tRPC handler rather than another route',
    ])
  }

  // A non-JSON answer carries no status, so it outranks the unreachable case.
  if (error.cause instanceof SyntaxError) {
    return new CliError(`The answer from ${url} is not tRPC JSON`, [
      'Point url at the tRPC handler, such as its /trpc mount path',
      'A subscription answers with a stream, which the tool does not read',
    ])
  }

  // Only fetch's own refusal lacks a status, where a server's error can quote the same words.
  const status = responseStatus(error)
  if (!status && redirectRefusedPattern.test(error.message)) {
    return new CliError(`The url ${url} redirects, which the tool does not follow`, ['Set url to the address the redirect points at'])
  }

  if (!status) return new CliError(`Request to ${url} failed: ${error.message}`, ['Check that the server is running and answers at the url itself'])

  return new CliError(`tRPC error (${status}): ${error.message}`)
}
