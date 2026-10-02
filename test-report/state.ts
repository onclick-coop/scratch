import { z } from 'zod'
import { CliError } from '../utils/error.utils.ts'
import { safe } from '../utils/safe.utils.ts'
import type { TableRow } from '../utils/table.utils.ts'
import { type RunState, runStateInput } from './schema.ts'

const START_HINT = 'Start a new state with the run command'

// Reads a state file the tool wrote, refusing one it cannot resume from as written.
export const parseState = (text: string, path: string): RunState => {
  const { data: json, error } = safe((): unknown => JSON.parse(text))
  if (error) throw new CliError(`The state at ${path} is not valid JSON: ${error.message}`, [START_HINT])

  const state = runStateInput.safeParse(json)
  if (!state.success) throw new CliError(`The state at ${path} has a shape the tool cannot read: ${z.prettifyError(state.error)}`, [START_HINT])

  return state.data
}

export const newState = (files: string[]): RunState => ({
  startedAt: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' }),
  files,
  reports: {},
})

export type FileRow = TableRow & {
  status: string
  file: string
}

export const toRows = (state: RunState): FileRow[] => (
  state.files.map((file) => {
    const report = state.reports[file]
    return { status: report === undefined ? 'pending' : report.status, file }
  })
)
