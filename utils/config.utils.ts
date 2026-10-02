import { resolve } from '@std/path'
import { z } from 'zod'
import { CliError } from './error.utils.ts'
import { safe, safeAsync } from './safe.utils.ts'

// deno task runs from the repo root and records the directory it was called from in INIT_CWD.
export const callerDirectory = (): string => {
  const { state } = Deno.permissions.querySync({ name: 'env', variable: 'INIT_CWD' })
  if (state !== 'granted') return Deno.cwd()

  return Deno.env.get('INIT_CWD') ?? Deno.cwd()
}

const fileSchema = z.record(z.string(), z.unknown())

// Reads the tools.config.json in a directory, where an absent file reads as an empty config.
export const readConfigText = async (directory: string): Promise<string> => {
  const configPath = resolve(directory, 'tools.config.json')
  const { data: text, error } = await safeAsync(() => Deno.readTextFile(configPath))
  if (!error) return text
  if (error instanceof Deno.errors.NotFound) return '{}'

  throw new CliError(`Failed to read ${configPath}: ${error.message}`, ['Make it a readable file, or remove it to use the defaults'])
}

// Returns a tool's section of a tools.config.json, where an absent section reads as empty.
export const configSection = (text: string, key: string): unknown => {
  const { data: json, error } = safe((): unknown => JSON.parse(text))
  if (error) {
    throw new CliError(`tools.config.json is not valid JSON: ${error.message}`, ['Fix the JSON, or remove the file to use the defaults'])
  }

  const file = fileSchema.safeParse(json)
  if (!file.success) {
    throw new CliError('tools.config.json must hold an object keyed by tool name', [`Write it as { "${key}": { ... } }`])
  }

  return Object.hasOwn(file.data, key) ? file.data[key] : {}
}
