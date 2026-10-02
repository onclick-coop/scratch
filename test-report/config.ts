import { basename, resolve } from '@std/path'
import { z } from 'zod'
import { configSection } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { type TestReportConfigInput, testReportConfigInput } from './schema.ts'

export type Settings = {
  directory: string
  glob: string
  args: string[]
  reportPath: string
  statePath: string
}

// Reads the test-report section of a tools.config.json, refusing one the tool cannot apply as written.
export const parseConfig = (text: string): TestReportConfigInput => {
  const config = testReportConfigInput.safeParse(configSection(text, 'test-report'))
  if (!config.success) {
    throw new CliError(`tools.config.json has a test-report section the tool cannot read: ${z.prettifyError(config.error)}`, [
      'Give it only directory, glob, args, report, and state',
      'Write args as a list of strings, such as ["task", "test"]',
    ])
  }

  return config.data
}

// The default names carry a hash of the whole project path, since two projects can share a directory name.
export const resolveSettings = async (config: TestReportConfigInput, root: string): Promise<Settings> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(root))
  const hash = Array.from(new Uint8Array(digest).slice(0, 4), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const project = `${basename(root)}-${hash}`

  return {
    directory: resolve(root, config.directory),
    glob: config.glob,
    args: config.args,
    reportPath: resolve(root, config.report ?? `/tmp/${project}-test-report.md`),
    statePath: resolve(root, config.state ?? `/tmp/${project}-test-report.json`),
  }
}
