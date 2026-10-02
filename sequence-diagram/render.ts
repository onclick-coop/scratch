import { CliError } from '../utils/error.utils.ts'
import { isAnnotationRow, isMessageRow, isOutgoingRow, isSelfRow } from './schema.ts'
import type { Diagram, MessageRow, OutgoingRow, Row, SelfRow } from './schema.ts'

const NAME_OFFSET = 4
const FIRST_NAME_COLUMN = 2
const HEAD_LENGTH = 3
const MIN_TAIL_LENGTH = 5
const STUB = '-- '
const NAME_GAP = 4
const TEXT_GAP = 4

type Line = string[]

type Layout = {
  diagram: Diagram
  columns: number[]
  widths: number[]
}

type ArrowInput = {
  row: MessageRow
  rightward: boolean
  width: number
}

type GapInput = {
  diagram: Diagram
  row: MessageRow
  index: number
}

type WriteInput = {
  line: Line
  start: number
  text: string
}

type MessageInput = {
  layout: Layout
  row: MessageRow
  index: number
}

type RowInput = {
  layout: Layout
  row: Row
  index: number
}

type Arrow = {
  source: number
  target: number
  rightward: boolean
}

type BlankInput = {
  row: Row
  arrow: Arrow | null
  previous: Arrow | null
  afterAnnotation: boolean
  afterLabel: boolean
}

const arrowWidth = (label: string): number => HEAD_LENGTH + 1 + label.length + 1 + MIN_TAIL_LENGTH + 1

const isRightward = (diagram: Diagram, row: MessageRow): boolean => {
  const { participants } = diagram

  return participants.indexOf(row.to) > participants.indexOf(row.from)
}

const arrowText = (input: ArrowInput): string => {
  const { row, rightward, width } = input

  const stroke = row.style === 'double' ? '=' : '-'
  const tail = stroke.repeat(width - arrowWidth(row.label) + MIN_TAIL_LENGTH)
  const body = `${stroke.repeat(HEAD_LENGTH)} ${row.label} `

  return rightward ? `${body}${tail}>` : `<${body}${tail}`
}

const outgoingText = (row: OutgoingRow): string => `${'-'.repeat(HEAD_LENGTH)} ${row.label} --> ${row.target}`

const gapIndex = (input: GapInput): number => {
  const { diagram, row, index } = input

  const from = diagram.participants.indexOf(row.from)
  const to = diagram.participants.indexOf(row.to)
  if (Math.abs(from - to) !== 1) {
    throw new CliError(`row ${index + 1} sends "${row.label}" between non-adjacent participants`, [
      'Messages can only travel between neighbouring lifelines',
      'Reorder the participants or split the message into hops',
    ])
  }

  return Math.min(from, to)
}

const gapWidths = (diagram: Diagram): number[] => {
  const { participants, rows } = diagram

  const widths = participants.slice(0, -1).map((name) => name.length + NAME_GAP - 1)
  const widen = (gap: number, width: number): void => {
    if (gap < 0 || gap >= widths.length) return
    widths[gap] = Math.max(widths[gap], width)
  }

  rows.forEach((row, index) => {
    if (isMessageRow(row)) {
      const gap = gapIndex({ diagram, row, index })
      widen(gap, arrowWidth(row.label))
      if (row.annotation) {
        const narrowest = arrowText({ row, rightward: isRightward(diagram, row), width: arrowWidth(row.label) })
        widen(gap, narrowest.indexOf(row.label) + row.annotation.length + TEXT_GAP)
      }

      if (row.note) widen(gap + 1, row.note.length + 1 + TEXT_GAP)
      return
    }

    if (isOutgoingRow(row)) {
      widen(participants.indexOf(row.from), outgoingText(row).length + TEXT_GAP)
      return
    }

    const at = participants.indexOf(row.at)
    if (isSelfRow(row)) {
      widen(at, STUB.length + row.text.length + TEXT_GAP)
      if (row.annotation) widen(at, STUB.length + row.annotation.length + TEXT_GAP)
    }

    if (isAnnotationRow(row)) widen(at, STUB.length + row.annotation.length + TEXT_GAP)
  })

  return widths
}

const blankLine = (columns: number[]): Line => {
  const line: Line = Array(columns[columns.length - 1] + 1).fill(' ')
  for (const column of columns) line[column] = '|'

  return line
}

const write = (input: WriteInput): void => {
  const { line, start, text } = input

  while (line.length < start) line.push(' ')
  for (let i = 0; i < text.length; i++) {
    line[start + i] = text[i]
  }
}

const finish = (line: Line): string => line.join('').trimEnd()

const renderHeader = (diagram: Diagram, columns: number[]): string => {
  const line: Line = Array(columns[columns.length - 1] + 1).fill(' ')
  diagram.participants.forEach((name, i) => write({ line, start: columns[i] - NAME_OFFSET, text: name }))

  return finish(line)
}

const renderMessage = (input: MessageInput): string[] => {
  const { layout, row, index } = input
  const { diagram, columns, widths } = layout

  const gap = gapIndex({ diagram, row, index })
  const arrow = arrowText({ row, rightward: isRightward(diagram, row), width: widths[gap] })

  const line = blankLine(columns)
  write({ line, start: columns[gap] + 1, text: arrow })
  if (row.note) write({ line, start: columns[gap + 1] + 2, text: row.note })
  const lines = [finish(line)]

  if (row.annotation) {
    const annotationLine = blankLine(columns)
    write({ line: annotationLine, start: columns[gap] + 1 + arrow.indexOf(row.label), text: row.annotation })
    lines.push(finish(annotationLine))
  }

  return lines
}

const renderOutgoing = (layout: Layout, row: OutgoingRow): string[] => {
  const { diagram, columns } = layout

  const line = blankLine(columns)
  write({ line, start: columns[diagram.participants.indexOf(row.from)] + 1, text: outgoingText(row) })

  return [finish(line)]
}

const renderSelf = (layout: Layout, row: SelfRow): string[] => {
  const { diagram, columns } = layout

  const column = columns[diagram.participants.indexOf(row.at)]
  const line = blankLine(columns)
  write({ line, start: column + 1, text: `${STUB}${row.text}` })
  const lines = [finish(line)]

  if (row.annotation) {
    const annotationLine = blankLine(columns)
    write({ line: annotationLine, start: column + 1 + STUB.length, text: row.annotation })
    lines.push(finish(annotationLine))
  }

  return lines
}

const renderRow = (input: RowInput): string[] => {
  const { layout, row, index } = input

  if (isMessageRow(row)) return renderMessage({ layout, row, index })
  if (isOutgoingRow(row)) return renderOutgoing(layout, row)
  if (isSelfRow(row)) return renderSelf(layout, row)

  const { diagram, columns } = layout
  const line = blankLine(columns)
  write({ line, start: columns[diagram.participants.indexOf(row.at)] + 1 + STUB.length, text: row.annotation })

  return [finish(line)]
}

const wantsBlankBefore = (input: BlankInput): boolean => {
  const { row, arrow, previous, afterAnnotation, afterLabel } = input

  if (afterLabel) return false
  if (isAnnotationRow(row)) return true
  if (!arrow) return false
  if (afterAnnotation) return true
  if (!previous) return false
  if (arrow.source !== previous.source && arrow.source !== previous.target) return true

  return arrow.rightward !== previous.rightward
}

export const render = (diagram: Diagram): string => {
  const widths = gapWidths(diagram)
  const columns = [FIRST_NAME_COLUMN + NAME_OFFSET]
  for (const width of widths) {
    columns.push(columns[columns.length - 1] + width + 1)
  }

  const layout = { diagram, columns, widths }
  const blank = finish(blankLine(columns))
  const lines = [renderHeader(diagram, columns), blank]
  let previous: Arrow | null = null
  let afterAnnotation = false
  let afterLabel = false
  diagram.rows.forEach((row, index) => {
    let arrow: Arrow | null = null
    if (isMessageRow(row)) {
      const source = diagram.participants.indexOf(row.from)
      const target = diagram.participants.indexOf(row.to)
      arrow = { source, target, rightward: target > source }
    }

    if (isOutgoingRow(row)) {
      const source = diagram.participants.indexOf(row.from)
      arrow = { source, target: source, rightward: true }
    }

    if (index > 0 && wantsBlankBefore({ row, arrow, previous, afterAnnotation, afterLabel })) lines.push(blank)
    lines.push(...renderRow({ layout, row, index }))
    if (arrow) previous = arrow
    afterAnnotation = (isMessageRow(row) || isSelfRow(row)) && Boolean(row.annotation)
    afterLabel = isAnnotationRow(row)
  })

  lines.push(blank, '')

  return lines.join('\n')
}
