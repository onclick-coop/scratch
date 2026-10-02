import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { parseConfig, resolveSession } from './config.ts'

describe('All Tmux Config Tests', () => {
  describe('parseConfig', () => {
    it('reads the session and the command that starts it', () => {
      // Act
      const config = parseConfig('{ "tmux": { "session": "work", "start": "./start.sh" } }')

      // Assert
      assertEquals(config, { session: 'work', start: './start.sh' })
    })

    it('reads an absent section as no session and no start command', () => {
      // Act
      const config = parseConfig('{ "commit": { "maxLength": 50 } }')

      // Assert
      assertEquals(config, {})
    })

    it('refuses a misspelled key rather than ignoring it', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "tmux": { "sesion": "work" } }'), CliError, 'tmux section the tool cannot read')
    })

    it('refuses an empty session, which would name no session at all', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "tmux": { "session": "" } }'), CliError, 'tmux section the tool cannot read')
    })

    it('refuses an empty start command, which would print a hint naming nothing', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "tmux": { "start": "" } }'), CliError, 'tmux section the tool cannot read')
    })

    it('refuses a session that is not a string', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "tmux": { "session": 3 } }'), CliError, 'tmux section the tool cannot read')
    })

    it('refuses a null section', () => {
      // Act & Assert
      assertThrows(() => parseConfig('{ "tmux": null }'), CliError, 'tmux section the tool cannot read')
    })
  })

  describe('resolveSession', () => {
    it('reaches the configured session and names its start command', () => {
      // Act
      const session = resolveSession(undefined, { session: 'work', start: './start.sh' })

      // Assert
      assertEquals(session, { name: 'work', startHint: 'Start the session with ./start.sh' })
    })

    it('gives the general hint for a configured session with no start command', () => {
      // Act
      const session = resolveSession(undefined, { session: 'work' })

      // Assert
      assertEquals(session, { name: 'work', startHint: 'Start the session, or pass --session naming a running one' })
    })

    it('lets the flag outrank the config, without the start command meant for the configured session', () => {
      // Act
      const session = resolveSession('other', { session: 'work', start: './start.sh' })

      // Assert
      assertEquals(session, { name: 'other', startHint: 'Start the session, or pass --session naming a running one' })
    })

    it('refuses to run when neither the flag nor the config names a session', () => {
      // Act
      const error = assertThrows(() => resolveSession(undefined, {}), CliError, 'No tmux session to reach')

      // Assert
      assertEquals(error.suggestions, ['Pass --session <name>', 'Or set "session" under "tmux" in tools.config.json'])
    })

    it('refuses an empty flag by its value rather than falling back to the configured session', () => {
      // Act & Assert
      assertThrows(() => resolveSession('', { session: 'work' }), CliError, 'Invalid --session value: ""')
    })
  })
})
