import { resolve } from '@std/path'
import { z } from 'zod'
import { configSection } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'

// The schemes spawn opens, so `localhost:3001` cannot pass with `localhost` read as its scheme.
export const protocolPattern = /^(?:https?|about|data|file)$/

// https://playwright.dev/docs/api/class-page#page-goto
const pageUrlInput = z.url({ protocol: protocolPattern })

// https://playwright.dev/docs/api/class-browser#browser-new-context
export const playwrightDebugConfigInput = z.strictObject({
  url: pageUrlInput.optional(),
  storageState: z.string().min(1).optional(),
})

export type PlaywrightDebugConfig = z.infer<typeof playwrightDebugConfigInput>

export type ContextOptions = {
  ignoreHTTPSErrors: boolean
  viewport: { width: number; height: number }
  storageState?: string
}

// Reads the playwright-debug section, refusing one the tool cannot apply as written.
export const parseConfig = (text: string): PlaywrightDebugConfig => {
  const config = playwrightDebugConfigInput.safeParse(configSection(text, 'playwright-debug'))
  if (!config.success) {
    throw new CliError(`tools.config.json has a playwright-debug section the tool cannot read: ${z.prettifyError(config.error)}`, [
      'Give it only url and storageState, spelled as the playwright-debug SKILL shows',
      'Write url with an http, https, about, data, or file scheme',
    ])
  }

  return config.data
}

// The flag wins over the config, so one run can open another page without editing the file.
export const resolveUrl = (flag: string | undefined, config: PlaywrightDebugConfig): string => {
  if (flag === undefined) {
    if (!config.url) throw new CliError('No page to open', ['Pass --url <url>', 'Or set "url" under "playwright-debug" in tools.config.json'])

    return config.url
  }

  const url = pageUrlInput.safeParse(flag)
  if (!url.success) {
    throw new CliError(`Invalid --url value: "${flag}"`, [
      'Pass an http, https, about, data, or file url, such as http://localhost:3000/ or about:blank',
    ])
  }

  return url.data
}

// A relative storage state path names a file in the project the task is called from.
export const toContextOptions = (config: PlaywrightDebugConfig, directory: string): ContextOptions => {
  const options: ContextOptions = { ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } }
  if (config.storageState) options.storageState = resolve(directory, config.storageState)

  return options
}
