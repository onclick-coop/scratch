import { z } from 'zod'

// Offsets into the file's text, so an edit splices the item and leaves every other byte as it was.
// An item opening with no paragraph, such as an empty bullet or a code fence, has no text.
export type Item = {
  content: string
  done: boolean
  hasBox: boolean
  hasText: boolean
  isLast: boolean
  line: number
  start: number
  markerEnd: number
  textStart: number
  textEnd: number
  end: number
}

// A section runs from its heading's line to the next second-level heading or the file's end.
export type Section = {
  name: string
  line: number
  start: number
  headingEnd: number
  end: number
  items: Item[]
}

// A command's result: the file's new text, unchanged when nothing was done, and what to print.
export type Outcome = {
  text: string
  output: string
}

export type Command = (argv: string[], text: string) => Outcome

// The todo section of tools.config.json, where file resolves against the calling directory.
export const todoConfigInput = z.strictObject({
  file: z.string().min(1).default('TODO.md'),
})

export type TodoConfig = z.infer<typeof todoConfigInput>
