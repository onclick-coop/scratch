import { diffColors, type Mismatch, summarize, toRows } from '../diff.ts'
import { createColorers } from '../highlight.ts'
import type { Language } from '../languages.ts'
import { labelCharacters, tagRules } from '../redundant.ts'
import type { ShikiTheme } from '../schema.ts'
import { readTheme, readZedFile } from '../sources.ts'

export type CompareInput = {
  checkout: string
  theme: ShikiTheme
  languages: readonly Language[]
}

// Colors each language's sample with Zed's queries and with Shiki, and lists where the two disagree.
export const collectMismatches = async (input: CompareInput): Promise<Mismatch[]> => {
  const { checkout, theme, languages } = input

  const syntax = await readTheme(checkout)
  const colorers = await createColorers(theme)
  const tagged = tagRules(theme.settings)
  const variant = { name: 'tagged', fg: tagged.fg, rules: tagged.rules }

  const mismatches: Mismatch[] = []
  for (const language of languages) {
    const code = await Deno.readTextFile(new URL(`../samples/${language.name}.txt`, import.meta.url))
    const queries = await readZedFile(checkout, language.queries)
    const zed = await colorers.zed({ language, code, queries, syntax })
    const winners = labelCharacters(colorers.characters({ variant, language: language.name, code }), tagged.labels)
    mismatches.push(...diffColors({ language: language.name, code, pieces: colorers.shiki(language, code), winners, zed }))
  }

  return mismatches
}

export const runCompare = async (input: CompareInput, json: boolean): Promise<void> => {
  const mismatches = await collectMismatches(input)

  if (json) {
    for (const mismatch of mismatches) console.log(JSON.stringify(mismatch))
  } else if (mismatches.length) {
    console.table(toRows(mismatches))
  }

  console.error(summarize(input.languages.map((language) => language.name), mismatches))
}
