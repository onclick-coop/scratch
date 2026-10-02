import type { TableRow } from '../../utils/table.utils.ts'
import { LANGUAGES } from '../languages.ts'
import { readPins } from '../pins.ts'
import type { ShikiTheme } from '../schema.ts'
import { readTheme, readZedFile } from '../sources.ts'
import { changeRows, paletteRows, parsePalette, pinRows, queryRow } from '../update.ts'
import { collectMismatches } from './compare.ts'

export type UpdateInput = {
  checkout: string
  pinned: string
  theme: ShikiTheme
  source: string
}

const printTable = (title: string, rows: readonly TableRow[]): void => {
  console.log(title)

  if (!rows.length) {
    console.log('  none\n')
    return
  }

  console.table(rows)
}

// Reports what moved between a checkout at the theme's pins and a current one, leaving every edit to the caller.
export const runUpdate = async (input: UpdateInput): Promise<void> => {
  const { checkout, pinned, theme, source } = input

  printTable('Commits the theme links, which the --pinned checkout should hold', pinRows(readPins(source)))

  const ours = parsePalette(source)
  const [pinnedTheme, currentTheme] = await Promise.all([readTheme(pinned), readTheme(checkout)])
  const palette = paletteRows({ ours, pinned: pinnedTheme.colors, current: currentTheme.colors })
  printTable('Palette colors differing from the current One Dark, or changed since the pinned checkout', palette)

  const queries: TableRow[] = []
  for (const language of LANGUAGES) {
    const [before, after] = await Promise.all([readZedFile(pinned, language.queries), readZedFile(checkout, language.queries)])
    queries.push(queryRow({ language: language.name, pinned: before, current: after }))
  }

  const changedQueries = queries.filter((row) => row.query === 'changed')
  printTable('Queries changed since the pinned checkout', changedQueries)

  const pinnedMismatches = await collectMismatches({ checkout: pinned, theme, languages: LANGUAGES })
  const currentMismatches = await collectMismatches({ checkout, theme, languages: LANGUAGES })
  const changes = changeRows(pinnedMismatches, currentMismatches)
  printTable('Mismatches the current checkout adds or resolves', changes)

  console.error(`${palette.length} palette colors, ${changedQueries.length} queries, and ${changes.length} mismatches changed since the pinned checkout`)
}
