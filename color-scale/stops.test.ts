import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseStops, refuseInsideStops } from './stops.ts'

describe('All Color Scale Stops Tests', () => {
  describe('parseStops', () => {
    it('extrapolates 975 and 1000 when no stops are named', () => {
      // Act & Assert
      assertEquals(parseStops(undefined), [975, 1000])
    })

    it('reads a comma-separated list, trimming spaces around each stop', () => {
      // Act & Assert
      assertEquals(parseStops('975'), [975])
      assertEquals(parseStops(' 25 , 975 '), [25, 975])
    })

    it('refuses an empty value or an empty part rather than skipping it', () => {
      // Act & Assert
      assertThrows(() => parseStops(''), CliError, 'Invalid --stops value: ""')
      assertThrows(() => parseStops(','), CliError, 'Invalid --stops value: ""')
      assertThrows(() => parseStops('975,'), CliError, 'Invalid --stops value: ""')
    })

    it('refuses a stop that is not written as plain digits', () => {
      // Act & Assert
      assertThrows(() => parseStops('0x3cf'), CliError, 'Invalid --stops value: "0x3cf"')
      assertThrows(() => parseStops('1e3'), CliError, 'Invalid --stops value: "1e3"')
      assertThrows(() => parseStops('975.0'), CliError, 'Invalid --stops value: "975.0"')
      assertThrows(() => parseStops('-5'), CliError, 'Invalid --stops value: "-5"')
    })

    it('refuses zero and a stop past the upper bound', () => {
      // Act & Assert
      assertThrows(() => parseStops('0'), CliError, 'Invalid --stops value: "0"')
      assertThrows(() => parseStops('2000000'), CliError, 'Invalid --stops value: "2000000"')
    })

    it('refuses a stop named twice', () => {
      // Act & Assert
      assertThrows(() => parseStops('975,975'), CliError, 'Duplicate stop in --stops: "975,975"')
    })
  })

  describe('refuseInsideStops', () => {
    it('accepts stops below the first stop and above the last', () => {
      // Act & Assert
      refuseInsideStops([50, 500, 950], [25, 975])
    })

    it('refuses a stop between two of the scale, naming its range', () => {
      // Act
      const error = assertThrows(() => refuseInsideStops([50, 500, 950], [975, 500]), CliError, 'Stop 500 lies inside the scale, which runs from 50 to 950')

      // Assert
      assertEquals(error.suggestions, ['Pass stops below 50 or above 950'])
    })

    it('refuses a stop equal to either end of the scale', () => {
      // Act & Assert
      assertThrows(() => refuseInsideStops([50, 500, 950], [50]), CliError, 'Stop 50 lies inside')
      assertThrows(() => refuseInsideStops([50, 500, 950], [950]), CliError, 'Stop 950 lies inside')
    })
  })
})
