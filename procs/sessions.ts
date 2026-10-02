import { z } from 'zod'
import { configSection } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { type ProcsConfigInput, procsConfigInput } from './schema.ts'

export type Session = {
  name: string
  config: string
  logDir: string | undefined
}

// Reads the procs section of a tools.config.json, refusing one the tool cannot apply as written.
export const parseSessions = (text: string): ProcsConfigInput => {
  const config = procsConfigInput.safeParse(configSection(text, 'procs'))
  if (!config.success) {
    throw new CliError(`tools.config.json has a procs section the tool cannot read: ${z.prettifyError(config.error)}`, [
      'Give it only sessions and defaultSession, and each session only config and logDir',
    ])
  }

  return config.data
}

export const selectSession = (config: ProcsConfigInput, flag: string | undefined): Session => {
  const names = Object.keys(config.sessions)
  if (!names.length) {
    throw new CliError('tools.config.json configures no procs sessions', [
      'Add one as { "procs": { "sessions": { "<name>": { "config": "<mprocs config path>" } } } }',
    ])
  }

  const valid = `Valid sessions: ${names.join(', ')}`
  const name = flag ?? config.defaultSession
  if (name === undefined) {
    throw new CliError('No session named', ['Pass --session <name>, or set defaultSession in tools.config.json', valid])
  }

  if (!Object.hasOwn(config.sessions, name)) throw new CliError(`Unknown session: "${name}"`, [valid])

  const { config: path, logDir } = config.sessions[name]

  return { name, config: path, logDir }
}
