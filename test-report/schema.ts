import { z } from 'zod'

// The test-report section of a tools.config.json, where each setting a project leaves out takes its default.
export const testReportConfigInput = z.strictObject({
  directory: z.string().min(1).default('.'),
  glob: z.string().min(1).default('**/*.test.ts'),
  args: z.array(z.string().min(1)).min(1).default(['test']),
  report: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
})

export type TestReportConfigInput = z.infer<typeof testReportConfigInput>

export const stepResultInput = z.object({
  name: z.string(),
  status: z.enum(['ok', 'failed', 'ignored']),
  ms: z.number(),
})

export type StepResult = z.infer<typeof stepResultInput>

export const failureDetailInput = z.object({
  step: z.string(),
  errorBlock: z.string(),
})

export type FailureDetail = z.infer<typeof failureDetailInput>

export const fileReportInput = z.object({
  file: z.string(),
  exitCode: z.number(),
  durationMs: z.number(),
  status: z.enum(['pass', 'fail', 'crash']),
  passed: z.number(),
  failed: z.number(),
  steps: z.array(stepResultInput),
  failures: z.array(failureDetailInput),
  rawOutput: z.string(),
})

export type FileReport = z.infer<typeof fileReportInput>

// The state file the tool writes after each file, read back by failed, continue, show, and list.
export const runStateInput = z.object({
  startedAt: z.string(),
  files: z.array(z.string()),
  reports: z.record(z.string(), fileReportInput),
})

export type RunState = z.infer<typeof runStateInput>
