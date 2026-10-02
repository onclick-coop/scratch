import { z } from 'zod'
import { CliError } from '../utils/error.utils.ts'
import { type ThemeFamilyOutput, themeStyleOutput } from './schema.ts'

const THEME_NAME = 'One Dark'

export type SyntaxTheme = {
  foreground: string
  colors: Record<string, string>
}

export type Capture = {
  name: string
  start: number
  end: number
}

export type ColorInput = {
  length: number
  captures: readonly Capture[]
  theme: SyntaxTheme
}

export type CharacterColor = {
  color: string
  capture: string
}

// Zed stores colors with an alpha byte and Shiki in upper case, so both compare as six lower-case digits.
export const normalizeColor = (color: string): string => color.toLowerCase().slice(0, 7)

// Reads One Dark out of one.json, where a key carrying no color renders in the editor foreground.
// Only One Dark's style is checked, so a shape change in another theme in the file breaks nothing.
export const toSyntaxTheme = (family: ThemeFamilyOutput): SyntaxTheme => {
  const [theme] = family.themes.filter((entry) => entry.name === THEME_NAME)
  if (!theme) throw new CliError(`one.json holds no theme named ${THEME_NAME}`, ['Check out a Zed commit whose one.json still carries it'])

  const style = themeStyleOutput.safeParse(theme.style)
  if (!style.success) throw new CliError(`one.json styles ${THEME_NAME} in a shape the tool cannot read: ${z.prettifyError(style.error)}`)

  const foreground = normalizeColor(style.data['editor.foreground'])
  const colors: Record<string, string> = {}
  for (const [key, entry] of Object.entries(style.data.syntax)) colors[key] = entry.color ? normalizeColor(entry.color) : foreground

  return { foreground, colors }
}

// Colors each character as Zed's buffer chunks do, looking a capture up by its longest dotted key prefix.
// A capture matching no key is skipped, and the last one pushed and not yet ended wins over its parents.
export const colorCharacters = (input: ColorInput): CharacterColor[] => {
  const { length, captures, theme } = input

  const keys = Object.keys(theme.colors).sort((a, b) => b.length - a.length)
  const queue = [...captures]
  const stack: { end: number; color: string; capture: string }[] = []
  const characters: CharacterColor[] = []

  for (let position = 0; position < length; position++) {
    let capture = queue.at(0)
    while (capture && capture.start <= position) {
      const { name, end } = capture
      const [key] = keys.filter((entry) => name === entry || name.startsWith(`${entry}.`))
      if (key) stack.push({ end, color: theme.colors[key], capture: name })
      queue.shift()
      capture = queue.at(0)
    }

    let top = stack.at(-1)
    while (top && top.end <= position) {
      stack.pop()
      top = stack.at(-1)
    }

    characters.push(top ? { color: top.color, capture: top.capture } : { color: theme.foreground, capture: '-' })
  }

  return characters
}
