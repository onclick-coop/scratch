import type { SuperJSON } from 'superjson'
import { CliError } from '../utils/error.utils.ts'
import { safe } from '../utils/safe.utils.ts'

type TemporalValue =
  | Temporal.Instant
  | Temporal.ZonedDateTime
  | Temporal.PlainDateTime
  | Temporal.PlainDate
  | Temporal.PlainTime
  | Temporal.PlainYearMonth
  | Temporal.PlainMonthDay
  | Temporal.Duration

type TemporalType = {
  name: string
  marker: string
  from: (text: string) => TemporalValue
  matches: (value: unknown) => boolean
}

// The name is the tag on the wire, so a server must register its codec under the same one.
export const TEMPORAL_TYPES: readonly TemporalType[] = [{
  name: 'Temporal.Instant',
  marker: '@instant:',
  from: (text) => Temporal.Instant.from(text),
  matches: (value) => value instanceof Temporal.Instant,
}, {
  name: 'Temporal.ZonedDateTime',
  marker: '@zoneddatetime:',
  from: (text) => Temporal.ZonedDateTime.from(text),
  matches: (value) => value instanceof Temporal.ZonedDateTime,
}, {
  name: 'Temporal.PlainDateTime',
  marker: '@plaindatetime:',
  from: (text) => Temporal.PlainDateTime.from(text),
  matches: (value) => value instanceof Temporal.PlainDateTime,
}, {
  name: 'Temporal.PlainDate',
  marker: '@plaindate:',
  from: (text) => Temporal.PlainDate.from(text),
  matches: (value) => value instanceof Temporal.PlainDate,
}, {
  name: 'Temporal.PlainTime',
  marker: '@plaintime:',
  from: (text) => Temporal.PlainTime.from(text),
  matches: (value) => value instanceof Temporal.PlainTime,
}, {
  name: 'Temporal.PlainYearMonth',
  marker: '@plainyearmonth:',
  from: (text) => Temporal.PlainYearMonth.from(text),
  matches: (value) => value instanceof Temporal.PlainYearMonth,
}, {
  name: 'Temporal.PlainMonthDay',
  marker: '@plainmonthday:',
  from: (text) => Temporal.PlainMonthDay.from(text),
  matches: (value) => value instanceof Temporal.PlainMonthDay,
}, {
  name: 'Temporal.Duration',
  marker: '@duration:',
  from: (text) => Temporal.Duration.from(text),
  matches: (value) => value instanceof Temporal.Duration,
}]

export const registerTemporalCodecs = (instance: SuperJSON): void => {
  for (const type of TEMPORAL_TYPES) {
    instance.registerCustom<TemporalValue, string>({
      isApplicable: (value): value is TemporalValue => type.matches(value),
      serialize: (value) => value.toString(),
      deserialize: (text) => type.from(text),
    }, type.name)
  }
}

// Walks a value parsed from JSON and builds a Temporal value from each string carrying a marker.
export const parseMarkers = (value: unknown): unknown => {
  if (typeof value === 'string') {
    const type = TEMPORAL_TYPES.find((entry) => value.startsWith(entry.marker))
    if (!type) return value

    const payload = value.slice(type.marker.length)
    const { data: parsed, error } = safe(() => type.from(payload))
    if (error) throw new CliError(`Invalid ${type.marker} payload "${payload}": ${error.message}`, [`Write a ${type.name} in its ISO 8601 form`])

    return parsed
  }

  if (Array.isArray(value)) return value.map(parseMarkers)

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, child]) => [key, parseMarkers(child)])

    return Object.fromEntries(entries)
  }

  return value
}
