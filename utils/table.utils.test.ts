import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { formatInstant, orDash } from './table.utils.ts'

describe('All Table Utils Tests', () => {
  describe('orDash', () => {
    it('passes a value through', () => {
      // Act & Assert
      assertEquals(orDash('edge'), 'edge')
    })

    it('shows a dash for a null, an undefined, and an empty string alike', () => {
      // Act & Assert
      assertEquals(orDash(null), '-')
      assertEquals(orDash(undefined), '-')
      assertEquals(orDash(''), '-')
    })
  })

  describe('formatInstant', () => {
    it('prints an instant to the second in UTC', () => {
      // Act & Assert
      assertEquals(formatInstant(1700000000123), '2023-11-14T22:13:20Z')
    })

    it('shows a dash for a null and an undefined alike', () => {
      // Act & Assert
      assertEquals(formatInstant(null), '-')
      assertEquals(formatInstant(undefined), '-')
    })
  })
})
