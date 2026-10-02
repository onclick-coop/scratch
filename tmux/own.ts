import { CliError } from '../utils/error.utils.ts'
import type { Pane } from './parse.ts'

// The prefix shows in `list` whose a window is, and the option keeps a renamed window out.
export const OWNED_PREFIX = 'claude-'
export const OWNED_OPTION = '@claude-owned'

// Lowercase letters, digits, and dashes, never starting on a dash or holding a `.` or `:`.
export const namePattern = /^[a-z0-9][a-z0-9-]*$/

// tmux splits a target on `.` and `:`, so a name holding either would address another window.
export const toWindowName = (name: string): string => {
  const bare = name.startsWith(OWNED_PREFIX) ? name.slice(OWNED_PREFIX.length) : name
  if (!namePattern.test(bare)) {
    throw new CliError(`Invalid window name: "${name}"`, [
      'Use lowercase letters, digits, and dashes',
      'The tool adds the claude- prefix itself',
    ])
  }

  return `${OWNED_PREFIX}${bare}`
}

export const isOwned = (pane: Pane): boolean => pane.owned && pane.windowName.startsWith(OWNED_PREFIX)

export const assertOwned = (pane: Pane, action: string): void => {
  if (isOwned(pane)) return

  throw new CliError(`Refusing to ${action} window "${pane.windowName}", which this tool does not own`, [
    `Only windows created with \`new\` carry the ${OWNED_OPTION} option`,
    'Reading any window is always allowed',
  ])
}
