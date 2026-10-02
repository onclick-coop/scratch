import { z } from 'zod'
import { configSection } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { type TodoConfig, todoConfigInput } from './schema.ts'

// Reads the todo section of a tools.config.json, refusing one the tool cannot apply as written.
export const parseConfig = (text: string): TodoConfig => {
  const config = todoConfigInput.safeParse(configSection(text, 'todo'))
  if (!config.success) {
    throw new CliError(`tools.config.json has a todo section the tool cannot read: ${z.prettifyError(config.error)}`, [
      'Give it only file, a path to the todo list',
    ])
  }

  return config.data
}
