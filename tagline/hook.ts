import { resolve } from '@std/path'
import { CliError } from '../utils/error.utils.ts'
import { safe, safeAsync } from '../utils/safe.utils.ts'
import { checkFindings, formatViolations, type ReadFile } from './checker.ts'
import { parseConfig } from './config.ts'
import { findBodyWrites } from './parser.ts'
import { bashCallInput, hookCwdInput } from './payload.ts'

export type HookInput = {
  raw: string
  readProjectDir: () => string | undefined
  readConfig: (directory: string) => Promise<string>
  readFile: ReadFile
}

export type HookResult = {
  code: 0 | 2
  message: string
}

export type HookFailure = {
  code: 1 | 2
  message: string
}

// `gh` as a command name or the tail of a path, a last resort when the parser itself failed.
export const ghWordPattern = /(^|[\s;&|(`'"/])gh(?=$|[\s;&|)`'"])/

const ALLOW: HookResult = { code: 0, message: '' }

const errorLines = (error: Error): string[] => {
  const lines = [`error: ${error.message}`]
  const isCliError = error instanceof CliError

  if (isCliError) {
    for (const suggestion of error.suggestions) {
      lines.push(`  - ${suggestion}`)
    }
  }

  return lines
}

// The payload's cwd, or the root for a payload naming none, which the setup then refuses.
const startDirectory = (payload: unknown): string => {
  const located = hookCwdInput.safeParse(payload)

  return located.success ? located.data.cwd : '/'
}

// Decides one PreToolUse call, reading the config only for a command that writes a GitHub body.
export const runHook = async (input: HookInput): Promise<HookResult> => {
  const { raw, readProjectDir, readConfig, readFile } = input

  const { data: payload, error: parseError } = safe((): unknown => JSON.parse(raw))
  if (parseError) return ALLOW

  const call = bashCallInput.safeParse(payload)
  if (!call.success) return ALLOW

  const findings = findBodyWrites(call.data.tool_input.command, startDirectory(payload))
  if (findings.length === 0) return ALLOW

  const loadSetup = async () => {
    const located = hookCwdInput.safeParse(payload)
    if (!located.success) {
      throw new CliError('The hook payload names no cwd', ['Claude Code sends one with every call, so give a payload written by hand a "cwd" too'])
    }

    const { cwd } = located.data
    const directory = readProjectDir() || cwd

    const { data: text, error: readError } = await safeAsync(() => readConfig(directory))
    if (readError) throw new CliError(readError.message, ['Make tools.config.json a readable file, since the hook has no defaults to fall back to'])

    return { cwd, config: parseConfig(text) }
  }

  const { data: setup, error: setupError } = await safeAsync(loadSetup)

  // An unchecked body must not get through, so any failure here blocks the write.
  if (setupError) {
    const lines = ['Blocked: this gh command writes a GitHub body, and the tagline check cannot run to verify it.', '', ...errorLines(setupError)]
    lines.push('')
    lines.push('Fix the setup, then re-run the command.')

    return { code: 2, message: lines.join('\n') }
  }

  const { cwd, config } = setup
  const violations = checkFindings({ findings, tagline: config.text, readFile: (path) => readFile(resolve(cwd, path)) })
  if (violations.length === 0) return ALLOW

  return { code: 2, message: formatViolations(violations, config) }
}

// Blocks a payload that may write a body on an unhandled error, and passes any other.
export const failClosed = (raw: string, error: Error): HookFailure => {
  const { data: payload } = safe((): unknown => JSON.parse(raw))
  const call = bashCallInput.safeParse(payload)
  if (!call.success) return { code: 1, message: errorLines(error).join('\n') }

  const { command } = call.data.tool_input
  const { data: findings, error: parseError } = safe(() => findBodyWrites(command, startDirectory(payload)))
  const mayWriteBody = parseError ? ghWordPattern.test(command) : findings.length > 0
  if (!mayWriteBody) return { code: 1, message: errorLines(error).join('\n') }

  const lines = ['Blocked: this gh command may write a GitHub body, and the tagline check failed before it could verify it.', '', ...errorLines(error)]

  return { code: 2, message: lines.join('\n') }
}
