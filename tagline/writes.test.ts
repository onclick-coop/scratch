import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { directoryOptionPattern, echoOptionPattern, stackRotationPattern } from './writes.ts'

describe('All Tagline Writes Tests', () => {
  describe('echoOptionPattern', () => {
    it('matches a cluster of echo options', () => {
      // Act & Assert
      assertEquals(echoOptionPattern.test('-n'), true)
      assertEquals(echoOptionPattern.test('-neE'), true)
    })

    it('refuses text that echo prints, such as another option letter or a bare dash', () => {
      // Act & Assert
      assertEquals(echoOptionPattern.test('-x'), false)
      assertEquals(echoOptionPattern.test('-'), false)
      assertEquals(echoOptionPattern.test('-n\n'), false)
    })
  })

  describe('directoryOptionPattern', () => {
    it('matches the options cd, pushd, and popd take', () => {
      // Act & Assert
      assertEquals(directoryOptionPattern.test('-P'), true)
      assertEquals(directoryOptionPattern.test('-n'), true)
    })

    it('refuses the dash that names the previous directory', () => {
      // Act & Assert
      assertEquals(directoryOptionPattern.test('-'), false)
    })
  })

  describe('stackRotationPattern', () => {
    it('matches a stack position', () => {
      // Act & Assert
      assertEquals(stackRotationPattern.test('+2'), true)
      assertEquals(stackRotationPattern.test('-0'), true)
    })

    it('refuses a directory name', () => {
      // Act & Assert
      assertEquals(stackRotationPattern.test('docs'), false)
      assertEquals(stackRotationPattern.test('+2\n'), false)
    })
  })
})
