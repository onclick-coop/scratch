import { z } from 'zod'
import { configSection } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'

// Maps each service to its log file, relative to the project root or absolute.
export const logConfigInput = z.strictObject({
  services: z.record(z.string().min(1), z.string().min(1)).default({}),
  defaultService: z.string().min(1).optional(),
}).refine((config) => config.defaultService === undefined || Object.hasOwn(config.services, config.defaultService), {
  message: 'defaultService names no service in services',
  path: ['defaultService'],
})

export type LogConfig = z.infer<typeof logConfigInput>

// Reads the log section of a tools.config.json, refusing one the tool cannot apply as written.
export const parseConfig = (text: string): LogConfig => {
  const config = logConfigInput.safeParse(configSection(text, 'log'))
  if (!config.success) {
    throw new CliError(`tools.config.json has a log section the tool cannot read: ${z.prettifyError(config.error)}`, [
      'Give it only services and defaultService, with each service mapped to its log file',
    ])
  }

  return config.data
}

export type PathInput = {
  service: string | undefined
  file: string | undefined
  config: LogConfig
}

// Returns the configured or passed log path, for the caller to resolve from its own directory.
export const resolveLogPath = (input: PathInput): string => {
  const { service, file, config } = input

  if (file === undefined) {
    const names = Object.keys(config.services)
    if (!names.length) {
      throw new CliError('tools.config.json configures no log services', [
        'Add one as { "log": { "services": { "<name>": "<log file path>" } } }',
        'Or pass --file <path>',
      ])
    }

    const valid = `Valid services: ${names.join(', ')}`
    const name = service ?? config.defaultService
    if (name === undefined) {
      throw new CliError('No service named', ['Pass --service <name>, or set defaultService in tools.config.json', valid])
    }

    if (!Object.hasOwn(config.services, name)) throw new CliError(`Unknown service: "${name}"`, [valid])

    return config.services[name]
  }

  if (!file) throw new CliError('Empty --file value', ['Pass --file <path>, resolved from the calling directory'])

  if (service !== undefined) throw new CliError('--file and --service name two different logs', ['Pass one or the other'])

  return file
}

// A missing file has a different fix for a passed path than for a configured one.
export const suggestMissing = (file: string | undefined): string => {
  if (file !== undefined) return 'Check the path, which is resolved from the directory deno task was called from'

  return 'Start whatever writes the log, or point the service at the file it writes in tools.config.json'
}
