import { z } from 'zod'
import { configSection } from '../utils/config.utils.ts'
import { CliError } from '../utils/error.utils.ts'
import { safe } from '../utils/safe.utils.ts'

const WRITE_SHAPE = 'Write it as { "tagline": { "text": "<the line every body ends with>", "stale": ["<an older spelling to strip>"] } }'

// The line every body must end with, and the older spellings a writer strips before appending it.
export const taglineConfigInput = z.strictObject({
  text: z
    .string({ error: (issue) => issue.input === undefined ? 'text is required, since the tool has no tagline of its own' : undefined })
    .min(1)
    .refine((text) => text === text.trim(), 'text must not start or end with whitespace'),
  stale: z.array(z.string().min(1)).default([]),
})

export type TaglineConfig = z.infer<typeof taglineConfigInput>

// Reads the tagline section of a tools.config.json, refusing one the tool cannot apply as written.
export const parseConfig = (text: string): TaglineConfig => {
  // The shared reader's suggestion names defaults, which this hook does not have.
  const { data: section, error } = safe(() => configSection(text, 'tagline'))
  if (error) throw new CliError(error.message, [WRITE_SHAPE])

  const config = taglineConfigInput.safeParse(section)
  if (!config.success) throw new CliError(`tools.config.json gives no tagline the tool can read: ${z.prettifyError(config.error)}`, [WRITE_SHAPE])

  return config.data
}
