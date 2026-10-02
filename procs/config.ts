import { resolve } from '@std/path'
import { parse } from '@std/yaml'
import { z } from 'zod'
import { stripCursorCodes } from '../utils/ansi.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safe } from '../utils/safe.utils.ts'
import { type MprocsConfigInput, mprocsConfigInput, serverInput } from './schema.ts'

// Digits only, since `Number` reads hex and scientific notation as whole numbers.
export const portPattern = /^\d+$/

const MAX_PORT = 65535

const readConfig = (raw: string): MprocsConfigInput => {
  const { data: yaml, error } = safe((): unknown => parse(raw))
  if (error) throw new CliError(`Unreadable mprocs config: ${error.message}`, ['The file is not valid yaml'])

  const config = mprocsConfigInput.safeParse(yaml)
  if (!config.success) {
    throw new CliError(`The mprocs config has a shape the tool cannot read: ${z.prettifyError(config.error)}`, [
      'Fix the key the error points at',
    ])
  }

  return config.data
}

export const parseProcNames = (raw: string): string[] => Object.keys(readConfig(raw).procs)

// The port comes from the file the procs do, so a run cannot target a listener gprocs never opened.
export const parseServerPort = (raw: string): number => {
  const { server: declared } = readConfig(raw)
  if (declared === undefined) {
    throw new CliError('Config declares no control server', [
      'Add `server: 127.0.0.1:<port>` to the mprocs config',
      'Restart gprocs afterwards so it binds the port',
    ])
  }

  const parsed = serverInput.safeParse(declared)
  if (!parsed.success) throw new CliError(`Config has an unreadable server address: ${JSON.stringify(declared)}`)

  const server = parsed.data
  const [, portPart] = server.split(':')
  const port = Number(portPart)
  if (!portPart || !portPattern.test(portPart) || port === 0 || port > MAX_PORT) {
    throw new CliError(`Config has an unreadable server address: "${server}"`)
  }

  return port
}

export type ProcLogPathInput = {
  root: string
  session: string
  logDir: string | undefined
  proc: string
}

export const procLogPath = (input: ProcLogPathInput): string => {
  const { root, session, logDir, proc } = input

  if (!logDir) {
    throw new CliError(`The ${session} session writes no proc logs`, [
      `Give the ${session} session a logDir in tools.config.json if gprocs runs it with --log-dir`,
    ])
  }

  return resolve(root, logDir, `${proc}.log`)
}

export const tailLines = (raw: string, lines: number): string => {
  // A file ending in a newline splits to a trailing empty string, which would print as nothing.
  const all = raw.trimEnd().split('\n')

  return all.slice(-lines).map(stripCursorCodes).join('\n')
}
