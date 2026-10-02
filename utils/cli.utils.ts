import { CliError } from './error.utils.ts'
import type { SafeResult } from './safe.utils.ts'

// Prints a CliError in the standard `error: <message>` + bullet-suggestion shape
// to stderr and exits with code 1. Re-throws non-CliError errors so the runtime
// surfaces stack traces for genuine bugs.
const printAndExit = (error: unknown): never => {
  if (!(error instanceof CliError)) {
    throw error
  }

  console.error(`error: ${error.message}`)

  for (const suggestion of error.suggestions) {
    console.error(`  - ${suggestion}`)
  }

  return Deno.exit(1)
}

// Throws a CliError directly through the standard printer.
export const handleCliError = (error: unknown): never => {
  return printAndExit(error)
}

// Unwraps a SafeResult, returning data on success or printing+exiting on error.
// Lets call sites narrow without non-null assertions.
export const unwrap = <T>(result: SafeResult<T>): T => {
  if (result.error) {
    return printAndExit(result.error)
  }

  return result.data
}
