import { join, toFileUrl } from '@std/path'
import { z } from 'zod'
import { CliError } from '../utils/error.utils.ts'
import { safe, safeAsync } from '../utils/safe.utils.ts'
import { THEME_PATH } from './languages.ts'
import { type ShikiTheme, themeFamilyOutput, themeModuleInput } from './schema.ts'
import { type SyntaxTheme, toSyntaxTheme } from './zed.ts'

export type ThemeFile = {
  theme: ShikiTheme
  source: string
}

// Loads the theme module at a path, checking it exports the Shiki theme as zedOneDark.
export const readThemeFile = async (path: string): Promise<ThemeFile> => {
  const { data: module, error: importError } = await safeAsync((): Promise<unknown> => import(toFileUrl(path).href))
  if (importError) throw new CliError(`Failed to load the theme at ${path}: ${importError.message}`, ['Pass --theme the path of a module exporting zedOneDark'])

  const parsed = themeModuleInput.safeParse(module)
  if (!parsed.success) {
    throw new CliError(`The theme at ${path} exports no Shiki theme as zedOneDark: ${z.prettifyError(parsed.error)}`, ['Export the theme as `zedOneDark`'])
  }

  return { theme: parsed.data.zedOneDark, source: await Deno.readTextFile(path) }
}

export const readZedFile = async (checkout: string, path: string): Promise<string> => {
  const { data: text, error } = await safeAsync(() => Deno.readTextFile(join(checkout, path)))
  if (error) {
    throw new CliError(`Failed to read ${path} in ${checkout}: ${error.message}`, [
      'Pass the path of a zed-industries/zed checkout',
      'Check out a newer Zed commit if this one predates the file',
    ])
  }

  return text
}

// Reads One Dark's syntax colors from a Zed checkout's one.json.
export const readTheme = async (checkout: string): Promise<SyntaxTheme> => {
  const text = await readZedFile(checkout, THEME_PATH)

  const { data: json, error } = safe((): unknown => JSON.parse(text))
  if (error) throw new CliError(`${THEME_PATH} in ${checkout} is not JSON: ${error.message}`, ['Pass the path of a zed-industries/zed checkout'])

  const family = themeFamilyOutput.safeParse(json)
  if (!family.success) {
    throw new CliError(`${THEME_PATH} in ${checkout} lists no themes: ${z.prettifyError(family.error)}`, ['Pass the path of a zed-industries/zed checkout'])
  }

  return toSyntaxTheme(family.data)
}
