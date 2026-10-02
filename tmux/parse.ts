import { CliError } from '../utils/error.utils.ts'

// tmux never reuses a pane or window id, while indexes are reused and names can be shared.
// Only an id still names the pane the ownership check approved by the time the write lands.
export type Pane = {
  window: number
  pane: number
  windowId: string
  paneId: string
  windowName: string
  command: string
  active: boolean
  owned: boolean
}

export const PANE_FORMAT: string = [
  '#{window_index}',
  '#{pane_index}',
  '#{window_id}',
  '#{pane_id}',
  '#{window_name}',
  '#{pane_current_command}',
  '#{&&:#{window_active},#{pane_active}}',
  '#{@claude-owned}',
].join('\t')

// Parses `tmux list-panes` output where each line follows PANE_FORMAT.
export const parsePanes = (output: string): Pane[] => {
  const panes: Pane[] = []

  for (const line of output.split('\n')) {
    if (!line.trim()) continue

    const [windowIndex, paneIndex, windowId, paneId, windowName, command, active, owned] = line.split('\t')

    // An absent id becomes an empty target, which tmux resolves to the focused pane.
    // A truncated line would then act on whatever the user is looking at.
    if (!windowId || !paneId) throw new CliError(`Unreadable pane line: "${line}"`, ['tmux reported a pane with no id'])

    panes.push({
      window: Number(windowIndex),
      pane: Number(paneIndex),
      windowId,
      paneId,
      windowName: windowName ?? '',
      command: command ?? '',
      active: active === '1',
      owned: owned === '1',
    })
  }

  return panes
}

// A window part with no dot or control character, then optionally a dot and a pane of digits.
// A negated class takes every character it does not name, so the control characters are named.
export const targetPattern = /^([^.\p{Cc}]+)(?:\.(\d+))?$/u

// Resolves a user-supplied window into one of the session's panes.
// Accepts a window name, a window index, or a `window.pane` / `name.pane` form.
export const resolvePane = (session: string, window: string | undefined, panes: Pane[]): Pane => {
  if (!window) {
    const active = panes.find((pane) => pane.active)
    if (!active) throw new CliError(`No active pane in session "${session}"`)

    return active
  }

  const parts = targetPattern.exec(window)
  if (!parts) throw new CliError(`Invalid --window value: "${window}"`, ['Name a window, or a pane as `<window>.<pane>`'])

  // The pattern's first group is non-empty, so the default only satisfies the type.
  const [, windowPart = '', paneDigits] = parts
  const index = Number(paneDigits ?? '0')

  const matching = panes.filter((entry) => String(entry.window) === windowPart || entry.windowName === windowPart)

  // tmux resolves a shared name to its first window, so the ambiguity is refused here instead.
  const indexes = [...new Set(matching.map((entry) => entry.window))]
  if (indexes.length > 1) {
    throw new CliError(`More than one window is named "${windowPart}"`, [`Address one by index: ${indexes.join(', ')}`])
  }

  if (matching.length) {
    const found = matching.find((entry) => entry.pane === index)
    if (found) return found

    const available = matching.map((entry) => entry.pane).join(', ')
    throw new CliError(`No pane ${index} in window "${windowPart}"`, [`Panes in that window: ${available}`])
  }

  const known = [...new Set(panes.map((entry) => `${entry.window} (${entry.windowName})`))]
  throw new CliError(`No window "${windowPart}" in session "${session}"`, [`Known windows: ${known.join(', ')}`])
}
