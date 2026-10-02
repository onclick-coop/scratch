import { assertEquals, assertExists, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parsePanes, resolvePane, targetPattern } from './parse.ts'

const SAMPLE = [
  '1\t0\t@1\t%1\tgit\tmprocs\t0\t0',
  '2\t0\t@2\t%2\tdev\tmprocs\t1\t0',
  '2\t1\t@2\t%3\tdev\tbash\t0\t0',
  '3\t0\t@3\t%4\tops\tmprocs\t0\t0',
].join('\n')

describe('All Tmux Parse Tests', () => {
  describe('parsePanes', () => {
    it('parses tab-delimited pane lines', () => {
      // Arrange
      const output = SAMPLE

      // Act
      const panes = parsePanes(output)

      // Assert
      assertEquals(panes.length, 4)
      assertEquals(panes[1], {
        window: 2,
        pane: 0,
        windowId: '@2',
        paneId: '%2',
        windowName: 'dev',
        command: 'mprocs',
        active: true,
        owned: false,
      })
    })

    it('reads the ownership option tmux reports for a window this tool created', () => {
      // Arrange
      const output = '6\t0\t@6\t%9\tclaude-fly\tbash\t0\t1'

      // Act
      const panes = parsePanes(output)

      // Assert
      const [pane] = panes
      assertExists(pane)
      assertEquals(pane.owned, true)
    })

    it('ignores blank lines', () => {
      // Arrange
      const output = `${SAMPLE}\n\n`

      // Act
      const panes = parsePanes(output)

      // Assert
      assertEquals(panes.length, 4)
    })
  })

  describe('targetPattern', () => {
    it('matches a bare window and captures no pane', () => {
      // Act
      const parts = targetPattern.exec('dev')

      // Assert
      assertExists(parts)
      assertEquals(parts[1], 'dev')
      assertEquals(parts[2], undefined)
    })

    it('captures the window and the pane of a two-part target', () => {
      // Act
      const parts = targetPattern.exec('dev.12')

      // Assert
      assertExists(parts)
      assertEquals(parts[1], 'dev')
      assertEquals(parts[2], '12')
    })

    it('matches a window named as digits, which is a name rather than a pane', () => {
      // Act
      const parts = targetPattern.exec('2')

      // Assert
      assertExists(parts)
      assertEquals(parts[1], '2')
      assertEquals(parts[2], undefined)
    })

    it('matches a name carrying dashes and underscores', () => {
      // Act
      const dashed = targetPattern.exec('claude-fly-login')
      const underscored = targetPattern.exec('fly_logs.3')

      // Assert
      assertExists(dashed)
      assertExists(underscored)
      assertEquals(dashed[1], 'claude-fly-login')
      assertEquals(underscored[2], '3')
    })

    it('rejects a trailing dot, which would otherwise read as pane 0', () => {
      // Act & Assert
      assertEquals(targetPattern.exec('dev.'), null)
    })

    it('rejects a pane part that is not digits', () => {
      // Act & Assert
      assertEquals(targetPattern.exec('dev.abc'), null)
      assertEquals(targetPattern.exec('dev.-1'), null)
      assertEquals(targetPattern.exec('dev.1a'), null)
      assertEquals(targetPattern.exec('dev. 1'), null)
    })

    it('rejects a third segment', () => {
      // Act & Assert
      assertEquals(targetPattern.exec('dev.0.7'), null)
    })

    it('rejects a target with no window part', () => {
      // Act & Assert
      assertEquals(targetPattern.exec('.'), null)
      assertEquals(targetPattern.exec('.1'), null)
      assertEquals(targetPattern.exec(''), null)
    })

    it('rejects a control character anywhere in the target, which the negated class would otherwise swallow', () => {
      // Act & Assert
      assertEquals(targetPattern.exec('dev\nops'), null)
      assertEquals(targetPattern.exec('dev.1\nops'), null)
      assertEquals(targetPattern.exec('dev\rops'), null)
      assertEquals(targetPattern.exec('dev\tops'), null)
      assertEquals(targetPattern.exec('dev\u{0}ops'), null)
      assertEquals(targetPattern.exec('dev\u{1B}ops'), null)
      assertEquals(targetPattern.exec('dev\u{7F}'), null)
    })
  })

  describe('resolvePane', () => {
    it('resolves the active pane when the window is omitted', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act
      const resolved = resolvePane('work', undefined, panes)

      // Assert
      assertEquals(resolved.windowName, 'dev')
      assertEquals(resolved.pane, 0)
    })

    it('resolves a window by name', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act
      const resolved = resolvePane('work', 'ops', panes)

      // Assert
      assertEquals(resolved.window, 3)
    })

    it('resolves a window by index', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act
      const resolved = resolvePane('work', '1', panes)

      // Assert
      assertEquals(resolved.window, 1)
    })

    it('resolves an explicit window.pane target', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act
      const resolved = resolvePane('work', 'dev.1', panes)

      // Assert
      assertEquals(resolved.command, 'bash')
    })

    it('throws with the known windows when the window is unknown', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act
      const error = assertThrows(() => resolvePane('work', 'nope', panes), CliError, 'No window "nope" in session "work"')

      // Assert
      assertEquals(error.suggestions, ['Known windows: 1 (git), 2 (dev), 3 (ops)'])
    })

    it('throws naming both indexes when two windows share the requested name', () => {
      // Arrange
      const panes = parsePanes([SAMPLE, '5\t0\t@5\t%8\tdev\tbash\t0\t0'].join('\n'))

      // Act
      const error = assertThrows(() => resolvePane('work', 'dev', panes), CliError, 'More than one window is named "dev"')

      // Assert
      assertEquals(error.suggestions, ['Address one by index: 2, 5'])
    })

    it('refuses a target ending in a dot, which would otherwise resolve to pane 0', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act & Assert
      assertThrows(() => resolvePane('work', 'dev.', panes), CliError)
    })

    it('refuses a pane part that is not digits, which would otherwise resolve to NaN', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act & Assert
      assertThrows(() => resolvePane('work', 'dev.abc', panes), CliError)
      assertThrows(() => resolvePane('work', 'dev.-1', panes), CliError)
    })

    it('refuses a third segment rather than dropping it', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act & Assert
      assertThrows(() => resolvePane('work', 'dev.0.7', panes), CliError)
    })

    it('refuses a bare dot, which names neither a window nor a pane', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act & Assert
      assertThrows(() => resolvePane('work', '.', panes), CliError)
    })

    it('throws with the available panes when the window has no such pane', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act
      const error = assertThrows(() => resolvePane('work', 'dev.4', panes), CliError, 'No pane 4 in window "dev"')

      // Assert
      assertEquals(error.suggestions, ['Panes in that window: 0, 1'])
    })
  })

  describe('pane ids', () => {
    it('carries the ids tmux reports, which still name the same pane after indexes shift', () => {
      // Arrange
      const panes = parsePanes(SAMPLE)

      // Act
      const pane = resolvePane('work', 'dev.1', panes)

      // Assert
      assertEquals(pane.paneId, '%3')
      assertEquals(pane.windowId, '@2')
    })

    it('refuses a pane line missing both ids, which would target the focused pane as an empty string', () => {
      // Act & Assert
      assertThrows(() => parsePanes('1\t0\t\t\tgit\tmprocs\t0\t0'), CliError)
    })

    it('refuses a pane line missing only the pane id, even with the window id present', () => {
      // Act & Assert
      assertThrows(() => parsePanes('1\t0\t@1\t\tgit\tmprocs\t0\t0'), CliError, 'Unreadable pane line')
    })
  })
})
