// The cell types console.table prints as text, so every row builder returns rows of this shape.
export type TableRow = Record<string, string | number>

// A field the source never held, or held empty, shows as a dash rather than a blank cell.
export const orDash = (value: string | null | undefined): string => (value ? value : '-')

// An instant prints to the second in UTC, and one the source never stamped shows as a dash.
export const formatInstant = (epochMs: number | null | undefined): string => {
  if (epochMs === null || epochMs === undefined) return '-'
  return Temporal.Instant.fromEpochMilliseconds(epochMs).toString({ smallestUnit: 'second' })
}
