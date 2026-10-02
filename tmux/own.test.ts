import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { assertOwned, isOwned, namePattern, toWindowName } from './own.ts'
import type { Pane } from './parse.ts'

const pane = (windowName: string, owned: boolean): Pane => ({
  window: 7,
  pane: 0,
  windowId: '@7',
  paneId: '%7',
  windowName,
  command: 'bash',
  active: false,
  owned,
})

describe('All Tmux Own Tests', () => {
  describe('namePattern', () => {
    it('matches lowercase letters, digits, and dashes', () => {
      // Act & Assert
      assertEquals(namePattern.test('fly-login'), true)
      assertEquals(namePattern.test('scratch2'), true)
      assertEquals(namePattern.test('a'), true)
      assertEquals(namePattern.test('7'), true)
    })

    it('rejects a leading dash, which tmux would read as an option', () => {
      // Act & Assert
      assertEquals(namePattern.test('-fly'), false)
    })

    it('rejects the separators tmux reads inside a target', () => {
      // Act & Assert
      assertEquals(namePattern.test('fly.login'), false)
      assertEquals(namePattern.test('fly:login'), false)
    })

    it('rejects uppercase, spaces, and underscores', () => {
      // Act & Assert
      assertEquals(namePattern.test('FlyLogin'), false)
      assertEquals(namePattern.test('fly login'), false)
      assertEquals(namePattern.test('fly_login'), false)
    })

    it('rejects an empty name', () => {
      // Act & Assert
      assertEquals(namePattern.test(''), false)
    })

    it('rejects a name carrying a newline, which the positive class excludes by naming what it allows', () => {
      // Act & Assert
      assertEquals(namePattern.test('fly\n'), false)
      assertEquals(namePattern.test('fly\nops'), false)
    })
  })

  describe('toWindowName', () => {
    it('prefixes a bare name', () => {
      // Act
      const name = toWindowName('fly-login')

      // Assert
      assertEquals(name, 'claude-fly-login')
    })

    it('leaves an already-prefixed name with one prefix', () => {
      // Act
      const name = toWindowName('claude-fly-login')

      // Assert
      assertEquals(name, 'claude-fly-login')
    })

    it('rejects a name carrying a tmux target separator', () => {
      // Act & Assert
      assertThrows(() => toWindowName('fly.login'), CliError)
      assertThrows(() => toWindowName('fly:login'), CliError)
    })

    it('rejects a name with spaces or uppercase', () => {
      // Act & Assert
      assertThrows(() => toWindowName('fly login'), CliError)
      assertThrows(() => toWindowName('FlyLogin'), CliError)
    })

    it('rejects an empty name', () => {
      // Act & Assert
      assertThrows(() => toWindowName(''), CliError)
    })
  })

  describe('isOwned', () => {
    it('accepts a window carrying both the option and the prefix', () => {
      // Act & Assert
      assertEquals(isOwned(pane('claude-fly', true)), true)
    })

    it('rejects a window renamed to the prefix without the option', () => {
      // Act & Assert
      assertEquals(isOwned(pane('claude-fake', false)), false)
    })

    it('rejects an option-carrying window renamed off the prefix', () => {
      // Act & Assert
      assertEquals(isOwned(pane('dev', true)), false)
    })

    it('rejects an ordinary window', () => {
      // Act & Assert
      assertEquals(isOwned(pane('dev', false)), false)
    })
  })

  describe('assertOwned', () => {
    it('passes an owned window through', () => {
      // Act & Assert
      assertOwned(pane('claude-fly', true), 'kill')
    })

    it('throws naming the window and the action for an unowned one', () => {
      // Act
      const error = assertThrows(() => assertOwned(pane('dev', false), 'kill'), CliError, 'Refusing to kill window "dev"')

      // Assert
      assertEquals(error.suggestions, [
        'Only windows created with `new` carry the @claude-owned option',
        'Reading any window is always allowed',
      ])
    })
  })
})
