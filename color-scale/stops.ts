import { CliError } from '../utils/error.utils.ts'
import { parseCount } from '../utils/parse.utils.ts'

// The two stops past the 950 that ends a Tailwind scale.
const DEFAULT_STOPS: readonly number[] = [975, 1000]

// Reads `--stops` as distinct whole numbers, refusing an empty part rather than skipping it.
export const parseStops = (raw: string | undefined): number[] => {
  if (raw === undefined) return [...DEFAULT_STOPS]

  const stops = raw.split(',').map((part) => parseCount(part.trim(), 0, '--stops'))
  if (new Set(stops).size !== stops.length) throw new CliError(`Duplicate stop in --stops: "${raw}"`, ['Name each stop once'])

  return stops
}

// Refuses a stop within the scale's range, since the tool only extends a scale past either end.
export const refuseInsideStops = (scale: readonly number[], targets: readonly number[]): void => {
  const first = Math.min(...scale)
  const last = Math.max(...scale)
  const [inside] = targets.filter((stop) => stop >= first && stop <= last)
  if (inside === undefined) return

  throw new CliError(`Stop ${inside} lies inside the scale, which runs from ${first} to ${last}`, [`Pass stops below ${first} or above ${last}`])
}
