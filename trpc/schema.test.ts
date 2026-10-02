import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { httpProtocolPattern } from './schema.ts'

describe('All Trpc Schema Tests', () => {
  describe('httpProtocolPattern', () => {
    it('matches the two schemes a tRPC handler answers on', () => {
      // Act & Assert
      assertEquals(httpProtocolPattern.test('http'), true)
      assertEquals(httpProtocolPattern.test('https'), true)
    })

    it('refuses a host read as a scheme, as `localhost:3002` would be', () => {
      // Act & Assert
      assertEquals(httpProtocolPattern.test('localhost'), false)
    })

    it('refuses a scheme that only starts or ends like http', () => {
      // Act & Assert
      assertEquals(httpProtocolPattern.test('httpx'), false)
      assertEquals(httpProtocolPattern.test('xhttp'), false)
      assertEquals(httpProtocolPattern.test('ws'), false)
    })

    it('refuses a scheme carrying a newline after it', () => {
      // Act & Assert
      assertEquals(httpProtocolPattern.test('http\n'), false)
    })
  })
})
