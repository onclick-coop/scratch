import { assert, assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { paletteModuleInput, scaleInput, stopPattern } from './schema.ts'

describe('All Color Scale Schema Tests', () => {
  describe('paletteModuleInput', () => {
    it('reads every export of a module by name, whatever its shape', () => {
      // Arrange
      const module = { zinc: { 50: [250, 250, 250] }, vendor: { discord: [88, 101, 242] }, VERSION: 3 }

      // Act
      const exports = paletteModuleInput.parse(module)

      // Assert
      assertEquals(exports, { zinc: { 50: [250, 250, 250] }, vendor: { discord: [88, 101, 242] }, VERSION: 3 })
    })
  })

  describe('scaleInput', () => {
    it('reads a scale keyed by stop with an rgb tuple at each', () => {
      // Arrange
      const scale = { 50: [250, 250, 250], 500: [113, 113, 123], 900: [24, 24, 27], 950: [9, 9, 11] }

      // Act
      const parsed = scaleInput.parse(scale)

      // Assert
      assertEquals(parsed, { 50: [250, 250, 250], 500: [113, 113, 123], 900: [24, 24, 27], 950: [9, 9, 11] })
    })

    it('refuses a scale of fewer than four stops, too few to check a curve against', () => {
      // Act & Assert
      assertThrows(() => scaleInput.parse({ 50: [250, 250, 250], 500: [113, 113, 123], 950: [9, 9, 11] }), Error, 'A scale needs at least 4 stops')
      assertThrows(() => scaleInput.parse({}), Error, 'A scale needs at least 4 stops')
    })

    it('refuses a key that is not a stop, as a map of named colors has', () => {
      // Act & Assert
      assertThrows(() => scaleInput.parse({ discord: [88, 101, 242], a: [0, 0, 0], b: [0, 0, 0], c: [0, 0, 0] }))
    })

    it('refuses a second spelling of a stop that would overwrite the first', () => {
      // Act & Assert
      assertThrows(() => scaleInput.parse({ 500: [20, 20, 25], '0500': [240, 240, 245], 600: [1, 1, 1], 700: [0, 0, 0] }))
    })

    it('refuses a color that is not three whole channels from 0 to 255', () => {
      // Arrange
      const stops = { 100: [0, 0, 0], 200: [0, 0, 0], 300: [0, 0, 0] }

      // Act & Assert
      assertThrows(() => scaleInput.parse({ ...stops, 50: [250, 250] }))
      assertThrows(() => scaleInput.parse({ ...stops, 50: [250, 250, 256] }))
      assertThrows(() => scaleInput.parse({ ...stops, 50: [250, 250, -1] }))
      assertThrows(() => scaleInput.parse({ ...stops, 50: [250, 250, 249.5] }))
      assertThrows(() => scaleInput.parse({ ...stops, 50: '#fafafa' }))
    })
  })

  describe('stopPattern', () => {
    it('matches a whole number with no leading zero', () => {
      // Act & Assert
      assert(stopPattern.test('5'))
      assert(stopPattern.test('950'))
    })

    it('refuses zero and a leading zero, which would name a stop a second way', () => {
      // Act & Assert
      assert(!stopPattern.test('0'))
      assert(!stopPattern.test('0500'))
    })

    it('refuses a decimal, an exponent, spaces, and a trailing newline', () => {
      // Act & Assert
      assert(!stopPattern.test('12.5'))
      assert(!stopPattern.test('1e2'))
      assert(!stopPattern.test(' 5'))
      assert(!stopPattern.test('5\n'))
    })
  })
})
