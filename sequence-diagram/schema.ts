import { z } from 'zod'
import { CliError } from '../utils/error.utils.ts'

// Matches a control character or a line or paragraph separator, any of which breaks a rendered row apart.
export const lineBreakingPattern = /[\p{Cc}\p{Zl}\p{Zp}]/u

const LINE_BREAKING_MESSAGE = 'must not contain a newline, tab, or other control character'

const textSchema = z.string().min(1).refine((text) => !lineBreakingPattern.test(text), LINE_BREAKING_MESSAGE)

const messageRowSchema = z.strictObject({
  from: textSchema,
  to: textSchema,
  label: textSchema,
  note: textSchema.optional(),
  annotation: textSchema.optional(),
  style: z.literal('double').optional(),
})

const outgoingRowSchema = z.strictObject({
  from: textSchema,
  label: textSchema,
  target: textSchema,
})

const selfRowSchema = z.strictObject({
  at: textSchema,
  text: textSchema,
  annotation: textSchema.optional(),
})

const annotationRowSchema = z.strictObject({
  at: textSchema,
  annotation: textSchema,
})

const rowSchema = z.union([messageRowSchema, outgoingRowSchema, selfRowSchema, annotationRowSchema])

const diagramSchema = z.strictObject({
  participants: z.array(textSchema).min(1),
  rows: z.array(rowSchema),
})

export type MessageRow = z.infer<typeof messageRowSchema>
export type OutgoingRow = z.infer<typeof outgoingRowSchema>
export type SelfRow = z.infer<typeof selfRowSchema>
export type AnnotationRow = z.infer<typeof annotationRowSchema>
export type Row = z.infer<typeof rowSchema>
export type Diagram = z.infer<typeof diagramSchema>

export const isMessageRow = (row: Row): row is MessageRow => 'to' in row
export const isOutgoingRow = (row: Row): row is OutgoingRow => 'target' in row
export const isSelfRow = (row: Row): row is SelfRow => 'text' in row

export const isAnnotationRow = (row: Row): row is AnnotationRow => {
  const hasText = 'text' in row

  return 'at' in row && !hasText
}

const rowParticipants = (row: Row): string[] => {
  if (isMessageRow(row)) return [row.from, row.to]
  if (isOutgoingRow(row)) return [row.from]
  if (isSelfRow(row) || isAnnotationRow(row)) return [row.at]

  return []
}

export const parseDiagram = (input: unknown): Diagram => {
  const result = diagramSchema.safeParse(input)
  if (!result.success) {
    const { issues } = result.error
    const places = issues.map((issue) => {
      const [head, index] = issue.path

      return head === 'rows' && typeof index === 'number' ? `row ${index + 1}` : String(head ?? 'root')
    })

    const suggestions = issues.map((issue, i) => `${places[i]}: ${issue.message} (${issue.path.join('.')})`)
    const matchesNoRowShape = issues.some((issue) => issue.code === 'invalid_union')
    if (matchesNoRowShape) {
      suggestions.push('Write each row as { from, to, label }, { from, label, target }, { at, text }, or { at, annotation }')
      suggestions.push('Run with --help for the optional keys of each row')
    }

    const [place = 'root'] = places
    throw new CliError(`Diagram JSON does not match the schema at ${place}`, suggestions)
  }

  const diagram = result.data
  const seen = new Set<string>()
  for (const participant of diagram.participants) {
    if (seen.has(participant)) {
      throw new CliError(`Duplicate participant "${participant}"`, ['Every participant name must be unique'])
    }

    seen.add(participant)
  }

  const known = `Known participants: ${diagram.participants.join(', ')}`
  diagram.rows.forEach((row, index) => {
    for (const name of rowParticipants(row)) {
      if (!seen.has(name)) throw new CliError(`Unknown participant "${name}" in row ${index + 1}`, [known])
    }
  })

  return diagram
}
