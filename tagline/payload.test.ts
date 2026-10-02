import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { bashCallInput, hookCwdInput } from './payload.ts'

describe('All Tagline Payload Tests', () => {
  describe('bashCallInput', () => {
    it('reads the command from a Bash call, ignoring the fields it does not use', () => {
      // Arrange
      const payload = { session_id: 's', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr list', description: 'x' } }

      // Act
      const call = bashCallInput.safeParse(payload)

      // Assert
      assertEquals(call.data, { tool_name: 'Bash', tool_input: { command: 'gh pr list' } })
    })

    it('passes over a call to another tool', () => {
      // Act
      const call = bashCallInput.safeParse({ tool_name: 'Edit', tool_input: { command: 'gh pr create --body x' } })

      // Assert
      assertEquals(call.success, false)
    })

    it('passes over a Bash call with no command string', () => {
      // Act & Assert
      assertEquals(bashCallInput.safeParse({ tool_name: 'Bash', tool_input: {} }).success, false)
      assertEquals(bashCallInput.safeParse({ tool_name: 'Bash', tool_input: { command: 4 } }).success, false)
    })

    it('passes over JSON that is not an object', () => {
      // Act & Assert
      assertEquals(bashCallInput.safeParse(null).success, false)
      assertEquals(bashCallInput.safeParse(['Bash']).success, false)
    })
  })

  describe('hookCwdInput', () => {
    it('reads the working directory the hook was called from', () => {
      // Act
      const located = hookCwdInput.safeParse({ cwd: '/work/project', tool_name: 'Bash' })

      // Assert
      assertEquals(located.data, { cwd: '/work/project' })
    })

    it('refuses a payload with no cwd or an empty one', () => {
      // Act & Assert
      assertEquals(hookCwdInput.safeParse({ tool_name: 'Bash' }).success, false)
      assertEquals(hookCwdInput.safeParse({ cwd: '' }).success, false)
    })
  })
})
