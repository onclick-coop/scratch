import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { CliError } from '../utils/error.utils.ts'
import { lineBreakingPattern, parseDiagram } from './schema.ts'

describe('All Sequence Diagram Schema Tests', () => {
  describe('lineBreakingPattern', () => {
    it('matches a newline, a carriage return, and a tab', () => {
      // Act & Assert
      assertEquals(lineBreakingPattern.test('go\nnow'), true)
      assertEquals(lineBreakingPattern.test('go\rnow'), true)
      assertEquals(lineBreakingPattern.test('go\tnow'), true)
    })

    it('matches the other control characters, from NUL and DEL to the C1 next-line', () => {
      // Act & Assert
      assertEquals(lineBreakingPattern.test('go\u{0}'), true)
      assertEquals(lineBreakingPattern.test('go\u{1B}[31m'), true)
      assertEquals(lineBreakingPattern.test('go\u{7F}'), true)
      assertEquals(lineBreakingPattern.test('go\u{85}now'), true)
    })

    it('matches the Unicode line and paragraph separators, which an editor breaks a line on', () => {
      // Act & Assert
      assertEquals(lineBreakingPattern.test('go\u{2028}now'), true)
      assertEquals(lineBreakingPattern.test('go\u{2029}now'), true)
    })

    it('refuses plain text with spaces and punctuation, which draws on one row', () => {
      // Act & Assert
      assertEquals(lineBreakingPattern.test('GET /fallback/ + token --> <db>.internal:5432'), false)
    })

    it('refuses a printable character outside ASCII, which draws on one row as well', () => {
      // Act & Assert
      assertEquals(lineBreakingPattern.test('caf\u{E9}'), false)
      assertEquals(lineBreakingPattern.test('\u{A0}'), false)
    })
  })

  describe('parseDiagram', () => {
    it('accepts every row kind as written', () => {
      // Arrange
      const input = {
        participants: ['A', 'B'],
        rows: [
          { from: 'A', to: 'B', label: 'go', note: 'n', annotation: 'a', style: 'double' },
          { from: 'B', label: 'for await', target: 'Consumer' },
          { at: 'A', text: 'self', annotation: 'under' },
          { at: 'B', annotation: 'why?' },
          { at: 'A', text: 'end' },
        ],
      }

      // Act
      const diagram = parseDiagram(input)

      // Assert
      assertEquals(diagram, {
        participants: ['A', 'B'],
        rows: [
          { from: 'A', to: 'B', label: 'go', note: 'n', annotation: 'a', style: 'double' },
          { from: 'B', label: 'for await', target: 'Consumer' },
          { at: 'A', text: 'self', annotation: 'under' },
          { at: 'B', annotation: 'why?' },
          { at: 'A', text: 'end' },
        ],
      })
    })

    it('rejects an empty participant list', () => {
      // Arrange
      const input = { participants: [], rows: [] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at participants')
    })

    it('rejects a duplicate participant', () => {
      // Arrange
      const input = { participants: ['A', 'A'], rows: [] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'Duplicate participant "A"')
    })

    it('rejects an unknown key on the diagram itself', () => {
      // Arrange
      const input = { participants: ['A'], rows: [], title: 'x' }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at root')
    })

    it('rejects an unknown participant in a message to', () => {
      // Arrange
      const input = { participants: ['A'], rows: [{ from: 'A', to: 'Z', label: 'go' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'Unknown participant "Z" in row 1')
    })

    it('rejects an unknown participant in a message from', () => {
      // Arrange
      const input = { participants: ['A'], rows: [{ from: 'Z', to: 'A', label: 'go' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'Unknown participant "Z" in row 1')
    })

    it('rejects an unknown participant in an off-diagram message from', () => {
      // Arrange
      const input = { participants: ['A'], rows: [{ from: 'Z', label: 'go', target: 'C' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'Unknown participant "Z" in row 1')
    })

    it('rejects an unknown participant at a self stub', () => {
      // Arrange
      const input = { participants: ['A'], rows: [{ at: 'Z', text: 'x' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'Unknown participant "Z" in row 1')
    })

    it('rejects an unknown participant at a standalone annotation', () => {
      // Arrange
      const input = { participants: ['A'], rows: [{ at: 'Z', annotation: 'x' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'Unknown participant "Z" in row 1')
    })

    it('rejects an unknown key on a message row, naming the row', () => {
      // Arrange
      const input = { participants: ['A', 'B'], rows: [{ from: 'A', to: 'B', label: 'go', colour: 'red' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at row 1')
    })

    it('rejects an unknown key on a self row, naming the row', () => {
      // Arrange
      const input = { participants: ['A'], rows: [{ at: 'A', text: 'x', note: 'n' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at row 1')
    })

    it('rejects an unknown key on an annotation row, naming the row', () => {
      // Arrange
      const input = { participants: ['A'], rows: [{ at: 'A', annotation: 'x', style: 'double' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at row 1')
    })

    it('rejects a style other than double, naming the row', () => {
      // Arrange
      const input = { participants: ['A', 'B'], rows: [{ from: 'A', to: 'B', label: 'go', style: 'dotted' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at row 1')
    })

    it('rejects a message carrying both to and target, naming the row', () => {
      // Arrange
      const input = { participants: ['A', 'B'], rows: [{ from: 'A', to: 'B', label: 'go', target: 'C' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at row 1')
    })

    it('rejects a message carrying neither to nor target, naming the row', () => {
      // Arrange
      const input = { participants: ['A'], rows: [{ from: 'A', label: 'go' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at row 1')
    })

    it('rejects an empty row, naming it', () => {
      // Arrange
      const input = { participants: ['A'], rows: [{ at: 'A', text: 'x' }, {}] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at row 2')
    })

    it('names the four row shapes when a row matches none of them, as a misspelled key does', () => {
      // Arrange
      const input = { participants: ['A', 'B'], rows: [{ from: 'A', to: 'B', lable: 'go' }] }

      // Act
      const error = assertThrows(() => parseDiagram(input), CliError)

      // Assert
      assertEquals(error.message, 'Diagram JSON does not match the schema at row 1')
      assertEquals(error.suggestions, [
        'row 1: Invalid input (rows.0)',
        'Write each row as { from, to, label }, { from, label, target }, { at, text }, or { at, annotation }',
        'Run with --help for the optional keys of each row',
      ])
    })

    it('leaves out the row shapes when the failure is not about a row', () => {
      // Arrange
      const input = { participants: [], rows: [] }

      // Act
      const error = assertThrows(() => parseDiagram(input), CliError)

      // Assert
      assertEquals(error.suggestions, ['participants: Too small: expected array to have >=1 items (participants)'])
    })

    it('rejects a newline in a label, naming the field', () => {
      // Arrange
      const input = { participants: ['A', 'B'], rows: [{ from: 'A', to: 'B', label: 'go\nnow' }] }

      // Act
      const error = assertThrows(() => parseDiagram(input), CliError)

      // Assert
      assertEquals(error.suggestions, ['row 1: must not contain a newline, tab, or other control character (rows.0.label)'])
    })

    it('rejects a control character in a note and an arrow annotation', () => {
      // Arrange
      const note = { participants: ['A', 'B'], rows: [{ from: 'A', to: 'B', label: 'go', note: 'a\tb' }] }
      const annotation = { participants: ['A', 'B'], rows: [{ from: 'A', to: 'B', label: 'go', annotation: 'a\nb' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(note), CliError, 'does not match the schema at row 1')
      assertThrows(() => parseDiagram(annotation), CliError, 'does not match the schema at row 1')
    })

    it('rejects a control character in an off-diagram label and target', () => {
      // Arrange
      const label = { participants: ['A'], rows: [{ from: 'A', label: 'a\nb', target: 'C' }] }
      const target = { participants: ['A'], rows: [{ from: 'A', label: 'go', target: 'C\r' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(label), CliError, 'does not match the schema at row 1')
      assertThrows(() => parseDiagram(target), CliError, 'does not match the schema at row 1')
    })

    it('rejects a control character in a self stub, its annotation, and a standalone annotation', () => {
      // Arrange
      const text = { participants: ['A'], rows: [{ at: 'A', text: 'a\nb' }] }
      const stubAnnotation = { participants: ['A'], rows: [{ at: 'A', text: 'x', annotation: 'a\u{2028}b' }] }
      const annotation = { participants: ['A'], rows: [{ at: 'A', annotation: 'a\u{0}b' }] }

      // Act & Assert
      assertThrows(() => parseDiagram(text), CliError, 'does not match the schema at row 1')
      assertThrows(() => parseDiagram(stubAnnotation), CliError, 'does not match the schema at row 1')
      assertThrows(() => parseDiagram(annotation), CliError, 'does not match the schema at row 1')
    })

    it('rejects a control character in a participant name', () => {
      // Arrange
      const input = { participants: ['A\nB'], rows: [] }

      // Act & Assert
      assertThrows(() => parseDiagram(input), CliError, 'does not match the schema at participants')
    })
  })
})
