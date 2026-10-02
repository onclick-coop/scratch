import { z } from 'zod'
import { CliError } from '../utils/error.utils.ts'
import { safe } from '../utils/safe.utils.ts'
import { resultObjectInput, type SessionsFileInput, sessionsFileInput, type TrpcConfigInput } from './schema.ts'

export type AuthHeadersInput = {
  sessions: SessionsFileInput
  url: string
  auth: TrpcConfigInput['auth']
}

// Refuses a file the tool cannot read rather than signing out of every server unasked.
export const parseSessions = (text: string, path: string): SessionsFileInput => {
  const { data: json, error } = safe((): unknown => JSON.parse(text))
  if (error) throw new CliError(`${path} is not valid JSON: ${error.message}`, [`Delete ${path} to sign out of every server`])

  const sessions = sessionsFileInput.safeParse(json)
  if (!sessions.success) {
    throw new CliError(`${path} has a shape the tool cannot read: ${z.prettifyError(sessions.error)}`, [`Delete ${path} to sign out of every server`])
  }

  return sessions.data
}

// A token goes only to the url it was issued for.
export const authHeaders = (input: AuthHeadersInput): Record<string, string> => {
  const { sessions, url, auth } = input

  if (!Object.hasOwn(sessions, url)) return {}

  return { [auth.header]: `${auth.prefix}${sessions[url].token}` }
}

// Follows a dotted path such as `session.access_token` into a procedure's result.
export const tokenAt = (result: unknown, path: string): string => {
  let value = result
  for (const key of path.split('.')) {
    const object = resultObjectInput.safeParse(value)
    if (!object.success || !Object.hasOwn(object.data, key)) {
      throw new CliError(`The result holds nothing at ${path}`, ["Set session.tokenPath to the dotted path of the token in this procedure's result"])
    }

    value = object.data[key]
  }

  if (typeof value !== 'string' || !value) {
    throw new CliError(`The result holds no token at ${path}`, ['Set session.tokenPath to a path ending on the token string'])
  }

  return value
}
