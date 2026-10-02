import { parseArgs } from '@std/cli/parse-args'
import { resolve, toFileUrl } from '@std/path'
import { z } from 'zod'
import { handleCliError, unwrap } from '../utils/cli.utils.ts'
import { callerDirectory } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safeAsync } from '../utils/safe.utils.ts'
import { backtest, backtestRows, extrapolate, extrapolationRows, stableHue } from './scale.ts'
import type { ScaleStop } from './scale.ts'
import { paletteModuleInput, scaleInput } from './schema.ts'
import { parseStops, refuseInsideStops } from './stops.ts'

const KNOWN_FLAGS = new Set(['help', 'h', 'palette', 'scale', 'stops'])

const args = parseArgs(Deno.args, {
  alias: { h: 'help' },
  boolean: ['help'],
  string: ['palette', 'scale', 'stops'],
})

const printHelp = (): void => {
  const lines = [
    'Usage: color-scale --palette <path> --scale <name> [--stops 975,1000]',
    '',
    'Measures a color scale in OKLCH, predicts each stop from its three nearest',
    'others to show how well the method fits, and extrapolates stops past either end.',
    '',
    'Options:',
    '  --palette <path> module exporting each scale as { [stop]: [r, g, b] } (required)',
    '  --scale <name>   exported scale to analyze (required)',
    '  --stops <list>   comma-separated stops past either end to extrapolate (default: 975,1000)',
    '  --help, -h       Show this help',
  ]

  console.log(lines.join('\n'))
}

const unknownKeys = Object.keys(args).filter((key) => key !== '_' && !KNOWN_FLAGS.has(key))
const unknownFlags = unknownKeys.map((key) => (key.length === 1 ? `-${key}` : `--${key}`))
if (unknownFlags.length) handleCliError(new CliError(`Unknown flag: ${unknownFlags.join(', ')}`, ['Run with --help for usage']))
if (args._.length) handleCliError(new CliError(`Unexpected argument: "${args._[0]}"`, ['Pass every input as a flag', 'Run with --help for usage']))

if (args.help) {
  printHelp()
  Deno.exit(0)
}

const loadScale = async (path: string, name: string | undefined): Promise<ScaleStop[]> => {
  const { data: module, error: importError } = await safeAsync((): Promise<unknown> => import(toFileUrl(path).href))
  if (importError) throw new CliError(`Failed to load the palette at ${path}: ${importError.message}`, ['Pass --palette the path of a module'])

  const exports = paletteModuleInput.parse(module)
  const scales = Object.keys(exports).filter((key) => scaleInput.safeParse(exports[key]).success)
  const isExported = name !== undefined && Object.hasOwn(exports, name)
  if (!isExported && !scales.length) throw new CliError(`The palette at ${path} exports no scales`, ['Export each scale as { [stop]: [r, g, b] }'])
  if (!name) throw new CliError('Missing --scale <name>', [`Available scales: ${scales.join(', ')}`])
  if (!isExported) throw new CliError(`Unknown scale: "${name}"`, [`Available scales: ${scales.join(', ')}`])

  const parsed = scaleInput.safeParse(exports[name])
  if (!parsed.success) {
    throw new CliError(`The export "${name}" is not a scale: ${z.prettifyError(parsed.error)}`, ['Export each scale as { [stop]: [r, g, b] }'])
  }

  return Object.entries(parsed.data).map(([stop, rgb]) => ({ stop: Number(stop), rgb }))
}

const run = async (): Promise<void> => {
  if (!args.palette) throw new CliError('Missing --palette <path>', ['Pass the path of a module exporting each scale as { [stop]: [r, g, b] }'])

  const targets = parseStops(args.stops)
  const stops = await loadScale(resolve(callerDirectory(), args.palette), args.scale)
  refuseInsideStops(stops.map((s) => s.stop), targets)

  const rows = backtest(stops)
  const maxError = Math.max(...rows.map((r) => r.maxErrorPct))

  console.log(`=== ${args.scale} scale in OKLCH, hue held at ${stableHue(stops).toFixed(2)} ===\n`)
  console.table(backtestRows(rows))
  console.log(`\nmax per-channel error: ${maxError.toFixed(3)}%`)

  console.log('\n=== extrapolated stops ===\n')
  console.table(extrapolationRows(targets.map((stop) => extrapolate(stops, stop))))
}

unwrap(await safeAsync(() => run()))

Deno.exit(0)
