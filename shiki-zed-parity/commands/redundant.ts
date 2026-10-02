import { createColorers, grammarScopes, type ThemeVariant } from '../highlight.ts'
import { SAMPLES } from '../languages.ts'
import { type Candidate, candidateRows, countChanged, countWins, fallbacksFor, isEmitted, labelCharacters, listSelectors, removeRule, removeSelector, type TaggedTheme, tagRules, type ThemeRule, wholeRuleRows } from '../redundant.ts'
import type { ShikiTheme } from '../schema.ts'

// Removes each selector alone, recolors every sample, and lists the selectors whose removal changed no character.
export const runRedundant = async (theme: ShikiTheme): Promise<void> => {
  const colorers = await createColorers(theme)
  const base: ThemeVariant = { name: theme.name, fg: theme.fg, rules: theme.settings }

  const samples = await Promise.all(SAMPLES.map(async (language) => ({ language, code: await Deno.readTextFile(new URL(`../samples/${language}.txt`, import.meta.url)) })))

  const colorAll = (variant: ThemeVariant): string[][] => samples.map(({ language, code }) => colorers.characters({ variant, language, code }))
  const labelAll = (name: string, tagged: TaggedTheme): string[][] => {
    return colorAll({ name, fg: tagged.fg, rules: tagged.rules }).map((characters) => labelCharacters(characters, tagged.labels))
  }

  const baseColors = colorAll(base)
  const baseWinners = labelAll('tagged', tagRules(base.rules))

  const changedBy = (name: string, rules: ThemeRule[]): number => {
    const colors = colorAll({ name, fg: base.fg, rules })
    return samples.reduce((sum, { code }, index) => sum + countChanged({ code, before: baseColors.at(index) ?? [], after: colors.at(index) ?? [] }), 0)
  }

  const scopes = grammarScopes()
  const selectors = listSelectors(base.rules)
  const candidates: Candidate[] = []
  const candidateRules = new Set<number>()

  for (const [index, selector] of selectors.entries()) {
    const rules = removeSelector(base.rules, selector)
    if (changedBy(`without-${index}`, rules)) continue

    const fallbackWinners = labelAll(`tagged-without-${index}`, tagRules(rules))
    const wins = samples.reduce((sum, { code }, position) => sum + countWins({ code, winners: baseWinners.at(position) ?? [], label: selector.selector }), 0)
    const fallback = samples.flatMap(({ code }, position) => {
      return fallbacksFor({ code, winners: baseWinners.at(position) ?? [], fallback: fallbackWinners.at(position) ?? [], label: selector.selector })
    })

    candidates.push({ selector: selector.selector, color: selector.color, wins, fallback: [...new Set(fallback)].sort(), emitted: isEmitted(selector.selector, scopes) })
    candidateRules.add(selector.rule)
  }

  const removableRules: number[] = []
  for (const rule of candidateRules) {
    const members = selectors.filter((selector) => selector.rule === rule)
    const allCandidates = members.every((member) => candidates.some((candidate) => candidate.selector === member.selector))
    if (members.length < 2 || !allCandidates || changedBy(`without-rule-${rule}`, removeRule(base.rules, rule))) continue

    removableRules.push(rule)
  }

  console.log('Selectors whose removal alone changes no sample character')
  console.table(candidateRows(candidates))

  if (removableRules.length) {
    console.log('Rules whose removal as a whole changes no sample character')
    console.table(wholeRuleRows(selectors, removableRules))
  }

  const dead = candidates.filter((candidate) => !candidate.emitted).length
  console.error(`${candidates.length} of ${selectors.length} selectors changed no character across ${samples.length} samples when removed alone.`)
  console.error(`${dead} match no scope a grammar emits, and the rest are candidates, since code the samples lack may need them.`)
}
