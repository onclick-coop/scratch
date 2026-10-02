import { CliError } from '../utils/error.utils.ts'
import { safeAsync } from '../utils/safe.utils.ts'
import { OWNED_OPTION } from './own.ts'
import { type Pane, PANE_FORMAT, parsePanes } from './parse.ts'

const SPAWN_FAILURE = 'Failed to run tmux'

const runTmux = async (args: string[]): Promise<string> => {
  const command = new Deno.Command('tmux', { args, stdout: 'piped', stderr: 'piped' })
  const { data, error } = await safeAsync(() => command.output())
  if (error) throw new CliError(`${SPAWN_FAILURE}: ${error.message}`, ['Is tmux installed and on PATH?'])

  const { code, stdout, stderr } = data
  if (code !== 0) {
    const message = new TextDecoder().decode(stderr).trim()
    throw new CliError(`tmux exited ${code}: ${message}`)
  }

  return new TextDecoder().decode(stdout)
}

// `has-session` fails for an absent session as for any error, so a missing binary is re-thrown.
export const sessionExists = async (session: string): Promise<boolean> => {
  const { error } = await safeAsync(() => runTmux(['has-session', '-t', session]))
  if (error?.message.startsWith(SPAWN_FAILURE)) throw error

  return !error
}

export const listPanes = async (session: string): Promise<Pane[]> => {
  const output = await runTmux(['list-panes', '-t', session, '-s', '-F', PANE_FORMAT])
  return parsePanes(output)
}

export const capturePane = async (pane: Pane, lines: number): Promise<string> => {
  return await runTmux(['capture-pane', '-p', '-t', pane.paneId, '-S', `-${lines}`])
}

// The tag targets the new window's id, since tmux resolves a shared name to the first window.
export const createWindow = async (session: string, name: string, cwd: string): Promise<void> => {
  const id = await runTmux(['new-window', '-d', '-t', session, '-n', name, '-c', cwd, '-P', '-F', '#{window_id}'])
  await runTmux(['set-option', '-w', '-t', id.trim(), OWNED_OPTION, '1'])
}

export const splitPane = async (pane: Pane): Promise<void> => {
  await runTmux(['split-window', '-d', '-t', pane.paneId])
}

// `send-keys` types into whatever runs in the pane, so the caller checks ownership first.
// `-l` sends the text as characters, `--` keeps a leading dash as text, and Enter goes on its own.
export const sendKeys = async (pane: Pane, text: string): Promise<void> => {
  const target = pane.paneId
  await runTmux(['send-keys', '-t', target, '-l', '--', text])
  await runTmux(['send-keys', '-t', target, 'Enter'])
}

export const killWindow = async (pane: Pane): Promise<void> => {
  await runTmux(['kill-window', '-t', pane.windowId])
}
