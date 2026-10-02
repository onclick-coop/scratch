import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { toDriver } from './driver.ts'

describe('All Playwright Debug Driver Tests', () => {
  describe('toDriver', () => {
    it('returns the function a module exports as default', () => {
      // Arrange
      const check = () => {}

      // Act
      const driver = toDriver({ default: check, helper: 1 }, '/work/app/check.ts')

      // Assert
      assertEquals(driver, check)
    })

    it('refuses a module exporting no default, naming the shape to export', () => {
      // Act
      const error = assertThrows(() => toDriver({ check: () => {} }, '/work/app/check.ts'), CliError, 'The driver at /work/app/check.ts must export a default function')

      // Assert
      assertEquals(error.suggestions, ['Export default async ({ browser, context, page }) => { ... }'])
    })

    it('refuses a default export that is not a function', () => {
      // Act & Assert
      assertThrows(() => toDriver({ default: { page: 1 } }, '/work/app/check.ts'), CliError, 'must export a default function')
    })
  })
})
