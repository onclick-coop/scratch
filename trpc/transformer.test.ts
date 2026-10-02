import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { superjsonTransformer } from './transformer.ts'

describe('All Trpc Transformer Tests', () => {
  describe('serialize', () => {
    it('tags each Temporal type with the name a server registers its codec under', () => {
      // Arrange
      const value = {
        instant: Temporal.Instant.from('2026-07-01T15:00:00Z'),
        zoned: Temporal.ZonedDateTime.from('2026-07-01T15:00:00+02:00[Europe/Paris]'),
        dateTime: Temporal.PlainDateTime.from('2026-07-01T15:00'),
        date: Temporal.PlainDate.from('2026-07-01'),
        time: Temporal.PlainTime.from('15:00'),
        yearMonth: Temporal.PlainYearMonth.from('2026-07'),
        monthDay: Temporal.PlainMonthDay.from('07-01'),
        duration: Temporal.Duration.from('PT1H'),
      }

      // Act
      const payload = superjsonTransformer.serialize(value)

      // Assert
      assertEquals(payload, {
        json: {
          instant: '2026-07-01T15:00:00Z',
          zoned: '2026-07-01T15:00:00+02:00[Europe/Paris]',
          dateTime: '2026-07-01T15:00:00',
          date: '2026-07-01',
          time: '15:00:00',
          yearMonth: '2026-07',
          monthDay: '07-01',
          duration: 'PT1H',
        },
        meta: {
          values: {
            instant: [['custom', 'Temporal.Instant']],
            zoned: [['custom', 'Temporal.ZonedDateTime']],
            dateTime: [['custom', 'Temporal.PlainDateTime']],
            date: [['custom', 'Temporal.PlainDate']],
            time: [['custom', 'Temporal.PlainTime']],
            yearMonth: [['custom', 'Temporal.PlainYearMonth']],
            monthDay: [['custom', 'Temporal.PlainMonthDay']],
            duration: [['custom', 'Temporal.Duration']],
          },
          v: 1,
        },
      })
    })

    it('sends plain JSON with no meta', () => {
      // Act & Assert
      assertEquals(superjsonTransformer.serialize({ id: 7 }), { json: { id: 7 } })
    })
  })

  describe('deserialize', () => {
    it('keeps the JSON half, where a tagged Temporal value is already its ISO string', () => {
      // Arrange
      const payload = { json: { at: '15:00:00' }, meta: { values: { at: [['custom', 'Temporal.PlainTime']] } } }

      // Act & Assert
      assertEquals(superjsonTransformer.deserialize(payload), { at: '15:00:00' })
    })

    it('keeps a BigInt and a Map in the JSON form superjson sent them in, so the result always prints', () => {
      // Arrange
      const payload = { json: { count: '12345678901234567890', byId: [['a', 1]] }, meta: { values: { count: ['bigint'], byId: ['map'] } } }

      // Act & Assert
      assertEquals(superjsonTransformer.deserialize(payload), { count: '12345678901234567890', byId: [['a', 1]] })
    })

    it('reads the envelope a void result arrives in as null', () => {
      // Act & Assert
      assertEquals(superjsonTransformer.deserialize({ json: null, meta: { values: ['undefined'], v: 1 } }), null)
    })

    it('refuses plain JSON, which has no json half to print', () => {
      // Act & Assert
      assertThrows(() => superjsonTransformer.deserialize({ auth: null }), Error, 'superjson envelope')
      assertThrows(() => superjsonTransformer.deserialize(undefined), Error, 'superjson envelope')
    })
  })
})
