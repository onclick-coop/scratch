import { z } from 'zod'
import { configSection } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { serverUrlInput, type TrpcConfigInput, trpcConfigInput } from './schema.ts'

// One or more slashes closing a url, which would otherwise double up before the procedure path.
export const trailingSlashPattern = /\/+$/

// Reads the trpc section of a tools.config.json, refusing one the tool cannot apply as written.
export const parseConfig = (text: string): TrpcConfigInput => {
  const config = trpcConfigInput.safeParse(configSection(text, 'trpc'))
  if (!config.success) {
    throw new CliError(`tools.config.json has a trpc section the tool cannot read: ${z.prettifyError(config.error)}`, [
      'Write url as an http or https url and transformer as superjson or none',
      'Write auth as { header, prefix } and session as { procedures, tokenPath }, with no other keys',
    ])
  }

  return config.data
}

// The flag wins over the config, so one run can reach another server without editing the file.
// A saved token is keyed by this url, so both spellings of one address have to resolve alike.
export const resolveUrl = (config: TrpcConfigInput, flag: string | undefined): string => {
  if (flag === undefined) {
    if (!config.url) {
      throw new CliError('No server url', [
        'Pass --url <url>, or set url in the trpc section of tools.config.json',
        "Call from the project's root, where deno task reads its tools.config.json",
      ])
    }

    return config.url.replace(trailingSlashPattern, '')
  }

  const url = serverUrlInput.safeParse(flag)
  if (!url.success) throw new CliError(`Invalid --url value: "${flag}"`, ['Pass the url the tRPC handler is mounted at, such as http://localhost:3000/trpc'])

  return url.data.replace(trailingSlashPattern, '')
}
