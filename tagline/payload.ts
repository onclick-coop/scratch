import { z } from 'zod'

// https://code.claude.com/docs/en/hooks#pretooluse-input
export const bashCallInput = z.object({
  tool_name: z.literal('Bash'),
  tool_input: z.object({
    command: z.string(),
  }),
})

// https://code.claude.com/docs/en/hooks#common-input-fields
export const hookCwdInput = z.object({
  cwd: z.string().min(1),
})

// https://docs.github.com/en/rest/issues/comments#create-an-issue-comment
export const apiInputBody = z.object({
  body: z.string().nullable().optional(),
})
