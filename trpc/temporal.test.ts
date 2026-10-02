import { assertEquals, assertInstanceOf, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseMarkers } from './temporal.ts'

describe('All Trpc Temporal Tests', () => {
  describe('parseMarkers', () => {
    it('builds an instant from a marked string', () => {
      // Act
      const value = parseMarkers('@instant:2026-07-01T15:00:00Z')

      // Assert
      assertInstanceOf(value, Temporal.Instant)
      assertEquals(value.toString(), '2026-07-01T15:00:00Z')
    })

    it('builds each Temporal type from its own marker', () => {
      // Act & Assert
      assertInstanceOf(parseMarkers('@zoneddatetime:2026-07-01T15:00:00+02:00[Europe/Paris]'), Temporal.ZonedDateTime)
      assertInstanceOf(parseMarkers('@plaindatetime:2026-07-01T15:00'), Temporal.PlainDateTime)
      assertInstanceOf(parseMarkers('@plaindate:2026-07-01'), Temporal.PlainDate)
      assertInstanceOf(parseMarkers('@plaintime:15:00'), Temporal.PlainTime)
      assertInstanceOf(parseMarkers('@plainyearmonth:2026-07'), Temporal.PlainYearMonth)
      assertInstanceOf(parseMarkers('@plainmonthday:07-01'), Temporal.PlainMonthDay)
      assertInstanceOf(parseMarkers('@duration:PT1H'), Temporal.Duration)
    })

    it('walks objects and arrays, leaving everything unmarked as it was', () => {
      // Act
      const value = parseMarkers({ id: 7, tags: ['a', '@plaindate:2026-07-01'], nested: { open: true, note: null } })

      // Assert
      assertEquals(value, { id: 7, tags: ['a', Temporal.PlainDate.from('2026-07-01')], nested: { open: true, note: null } })
    })

    it('leaves an unmarked ISO string a string, so a field that only looks like a date is sent as written', () => {
      // Act & Assert
      assertEquals(parseMarkers('2026-07-01T15:00:00Z'), '2026-07-01T15:00:00Z')
    })

    it('leaves a marker that does not open the string untouched', () => {
      // Act & Assert
      assertEquals(parseMarkers('due @instant:2026-07-01T15:00:00Z'), 'due @instant:2026-07-01T15:00:00Z')
    })

    it('refuses a marked string whose payload does not parse, naming the payload', () => {
      // Act & Assert
      assertThrows(() => parseMarkers('@instant:not-a-date'), CliError, 'not-a-date')
      assertThrows(() => parseMarkers({ at: '@plaintime:25:00' }), CliError, '25:00')
    })
  })
})
