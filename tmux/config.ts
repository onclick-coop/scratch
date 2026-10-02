import { z } from 'zod'
import { configSection } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'

// The session to target, per https://man.openbsd.org/tmux#COMMANDS, and the command that starts it.
export const tmuxConfigInput = z.strictObject({
  session: z.string().min(1).optional(),
  start: z.string().min(1).optional(),
})

export type TmuxConfig = z.infer<typeof tmuxConfigInput>

export type Session = {
  name: string
  startHint: string
}

const GENERIC_START_HINT = 'Start the session, or pass --session naming a running one'

// Reads the tmux section of a tools.config.json, refusing one the tool cannot apply as written.
export const parseConfig = (text: string): TmuxConfig => {
  const config = tmuxConfigInput.safeParse(configSection(text, 'tmux'))
  if (!config.success) {
    throw new CliError(`tools.config.json has a tmux section the tool cannot read: ${z.prettifyError(config.error)}`, [
      'Give it only session and start, spelled as the tmux SKILL shows',
    ])
  }

  return config.data
}

// Picks the session a run reaches and the hint printed when that session is not running.
export const resolveSession = (flag: string | undefined, config: TmuxConfig): Session => {
  // An empty flag is a typo, so it is refused before the config could stand in for it.
  if (flag === '') {
    throw new CliError('Invalid --session value: ""', ['Name a session, or leave out --session to use the configured one'])
  }

  // A flag names the session for this run alone, so the config's start command may not apply to it.
  if (flag) {
    return { name: flag, startHint: GENERIC_START_HINT }
  }

  if (!config.session) {
    throw new CliError('No tmux session to reach', ['Pass --session <name>', 'Or set "session" under "tmux" in tools.config.json'])
  }

  const startHint = config.start ? `Start the session with ${config.start}` : GENERIC_START_HINT
  return { name: config.session, startHint }
}
