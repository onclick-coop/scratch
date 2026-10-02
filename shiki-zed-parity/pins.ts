import { CliError } from '../utils/error.utils.ts'

// The theme's one.json permalink, capturing the commit SHA it pins.
export const themeLinkPattern = /github\.com\/zed-industries\/zed\/blob\/([0-9a-f]{40})\/assets\/themes\/one\/one\.json/

// The theme's link to Zed's grammar queries, capturing the commit SHA it pins.
export const queriesLinkPattern = /github\.com\/zed-industries\/zed\/tree\/([0-9a-f]{40})\/crates\/grammars\/src/

export type Pins = {
  theme: string
  queries: string
}

// Reads the commits the theme's links pin, which update's --pinned checkout should hold.
export const readPins = (source: string): Pins => {
  const [, theme] = themeLinkPattern.exec(source) ?? []
  const [, queries] = queriesLinkPattern.exec(source) ?? []

  if (!theme || !queries) {
    throw new CliError('The theme is missing its one.json or crates/grammars/src link', ['Link both at full zed-industries/zed commit SHAs in the theme comments'])
  }

  return { theme, queries }
}
