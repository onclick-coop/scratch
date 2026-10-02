import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { ansiPattern, cursorPattern, stripAnsi, stripCursorCodes } from './ansi.utils.ts'

describe('All Ansi Utils Tests', () => {
  describe('ansiPattern', () => {
    it('matches a colour escape', () => {
      // Act & Assert
      assertEquals('\x1b[32mINF\x1b[0m'.replace(ansiPattern, ''), 'INF')
    })

    it('refuses a cursor move, which a printed line should keep no more than a colour', () => {
      // Act & Assert
      assertEquals('\x1b[2Kready'.replace(ansiPattern, ''), '\x1b[2Kready')
    })

    it('refuses a bare bracket sequence carrying no escape byte', () => {
      // Act & Assert
      assertEquals('[32mready'.replace(ansiPattern, ''), '[32mready')
    })
  })

  describe('cursorPattern', () => {
    it('matches the cursor moves and erases a watcher writes to repaint its line', () => {
      // Act & Assert
      assertEquals('\x1b[0G\x1b[2K\x1b[Jready'.replace(cursorPattern, ''), 'ready')
    })

    it('matches the moves up, down, forward, back, to the next and previous line, and to a position', () => {
      // Act & Assert
      assertEquals('\x1b[1A\x1b[1B\x1b[1C\x1b[1D\x1b[1E\x1b[1F\x1b[3;4H\x1b[3;4fready'.replace(cursorPattern, ''), 'ready')
    })

    it('matches the scroll up and scroll down a full-screen redraw writes', () => {
      // Act & Assert
      assertEquals('\x1b[2S\x1b[2Tready'.replace(cursorPattern, ''), 'ready')
    })

    it('refuses an escape whose final letter is outside the cursor verbs, such as insert line', () => {
      // Act & Assert
      assertEquals('\x1b[1Lready'.replace(cursorPattern, ''), '\x1b[1Lready')
      assertEquals('\x1b[1Iready'.replace(cursorPattern, ''), '\x1b[1Iready')
    })

    it('refuses a colour escape, whose final byte is `m` rather than a cursor verb', () => {
      // Act & Assert
      assertEquals('\x1b[32mready'.replace(cursorPattern, ''), '\x1b[32mready')
    })
  })

  describe('stripAnsi', () => {
    it('drops every colour escape in a line rather than only the first', () => {
      // Act
      const line = stripAnsi('\x1b[32mINF\x1b[0m app \x1b[31mERR\x1b[0m')

      // Assert
      assertEquals(line, 'INF app ERR')
    })

    it('leaves a line carrying no escapes alone', () => {
      // Act
      const line = stripAnsi('voice listening on 3010')

      // Assert
      assertEquals(line, 'voice listening on 3010')
    })
  })

  describe('stripCursorCodes', () => {
    it('drops the cursor moves a watcher writes to repaint its line', () => {
      // Act
      const line = stripCursorCodes('\x1b[0G\x1b[2K\x1b[J02:04:17 INF voice listening')

      // Assert
      assertEquals(line, '02:04:17 INF voice listening')
    })

    it('keeps colour escapes, which a terminal renders rather than garbles', () => {
      // Act
      const line = stripCursorCodes('\x1b[32mINF\x1b[0m ready')

      // Assert
      assertEquals(line, '\x1b[32mINF\x1b[0m ready')
    })

    it('leaves a line carrying no escapes alone', () => {
      // Act
      const line = stripCursorCodes('voice listening on 3010')

      // Assert
      assertEquals(line, 'voice listening on 3010')
    })
  })
})
