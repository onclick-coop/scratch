import { CliError } from '../utils/error.utils.ts'

export const ACTIONS = ['restart', 'force-restart', 'start', 'stop', 'kill'] as const

export type ActionName = typeof ACTIONS[number]

const CONTROL_COMMANDS: Record<ActionName, string> = {
  'restart': 'restart-proc',
  'force-restart': 'force-restart-proc',
  'start': 'start-proc',
  'stop': 'term-proc',
  'kill': 'kill-proc',
}

export const isAction = (value: string): value is ActionName => ACTIONS.some((entry) => entry === value)

// A control command is one line of yaml, so a newline in a name would frame a second command.
export const newlinePattern = /[\r\n]/

export const assertProcName = (name: string): void => {
  if (!name) throw new CliError('Empty proc name', ['Run `procs list` to see the procs in the config'])
  if (!newlinePattern.test(name)) return

  throw new CliError(`Invalid proc name: "${name}"`, [
    'A proc name cannot span lines',
    'Run `procs list` to see the procs in the config',
  ])
}

// Quoted as a yaml double-quoted scalar, since a colon would otherwise close the mapping key.
const quote = (name: string): string => `"${name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

export const buildCommand = (action: ActionName, name: string): string => {
  assertProcName(name)

  return `{c: ${CONTROL_COMMANDS[action]}, name: ${quote(name)}}`
}
