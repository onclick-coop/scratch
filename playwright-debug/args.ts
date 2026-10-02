import { CliError } from '../utils/error.utils.ts'
import { countPattern, toInvocation } from '../utils/parse.utils.ts'

export const DEFAULT_PORT = 9222
const MAX_PORT = 65535
const COMMANDS: readonly string[] = ['spawn', 'attach']
const WITH_ARGUMENT: readonly string[] = ['attach']

export type CommandInput = {
  positionals: string[]
  unknownFlags: string[]
  hasUrl: boolean
}

export type Command = { name: 'spawn' } | { name: 'attach'; driver: string }

// Reads the verb and the driver path, refusing any input a verb cannot use.
export const toCommand = (input: CommandInput): Command => {
  const { positionals, unknownFlags, hasUrl } = input

  // No verb is the default, so a bare run falls back to a command no verb matches.
  const { command, argument } = toInvocation({ positionals, commands: COMMANDS, withArgument: WITH_ARGUMENT, fallback: '', unknownFlags })
  if (command === 'spawn') return { name: 'spawn' }

  if (argument === undefined) throw new CliError('No driver to run', ['Pass the driver path after the command, as `attach drivers/check.ts`'])
  if (hasUrl) throw new CliError('The attach command takes no --url', ['--url sets the page spawn opens, so it applies to spawn alone'])

  return { name: 'attach', driver: argument }
}

// Reads the DevTools protocol port, falling back to the port Chrome documents for remote debugging.
export const parsePort = (value: string | undefined): number => {
  if (value === undefined) return DEFAULT_PORT

  const port = Number(value)
  if (!countPattern.test(value) || port === 0 || port > MAX_PORT) {
    throw new CliError(`Invalid --port value: "${value}"`, [`Pass a whole number between 1 and ${MAX_PORT}`])
  }

  return port
}
