import { dirname, join } from '@std/path'
import { CliError } from '../utils/error.utils.ts'
import { safeAsync } from '../utils/safe.utils.ts'
import { parseSessions } from './session.ts'
import type { SessionsFileInput } from './schema.ts'

export const sessionsPath = (): string => {
  const home = Deno.env.get('HOME')
  if (!home) throw new CliError('HOME is not set', ['Set HOME to the directory the saved sessions live under'])

  return join(home, '.trpc', 'sessions.json')
}

// An absent file reads as signed out of every server.
export const readSessions = async (path: string): Promise<SessionsFileInput> => {
  const { data: text, error } = await safeAsync(() => Deno.readTextFile(path))
  if (!error) return parseSessions(text, path)
  if (error instanceof Deno.errors.NotFound) return {}

  throw new CliError(`Failed to read ${path}: ${error.message}`, ['Make it readable, or delete it to sign out of every server'])
}

// The file holds live tokens, so it is written owner-only and swapped in whole.
export const writeSessions = async (sessions: SessionsFileInput, path: string): Promise<void> => {
  const parent = dirname(path)

  const replaceSessionsFile = async (): Promise<void> => {
    await Deno.mkdir(parent, { recursive: true, mode: 0o700 })
    await Deno.chmod(parent, 0o700)

    const tmpPath = `${path}.${crypto.randomUUID()}.tmp`
    await Deno.writeTextFile(tmpPath, JSON.stringify(sessions, null, 2), { mode: 0o600 })
    await Deno.rename(tmpPath, path)
  }

  const { error } = await safeAsync(replaceSessionsFile)
  if (error) throw new CliError(`Failed to write ${path}: ${error.message}`, [`Make ${parent} a directory you own`])
}
