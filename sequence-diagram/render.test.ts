import { assertEquals, assertThrows } from '@std/assert'
import { describe, it } from 'node:test'
import { fromFileUrl } from '@std/path'
import { CliError } from '../utils/error.utils.ts'
import { parseDiagram } from './schema.ts'
import { render } from './render.ts'

const readFixture = (name: string, extension: string): string => {
  return Deno.readTextFileSync(fromFileUrl(new URL(`./fixtures/${name}.${extension}`, import.meta.url)))
}

describe('All Sequence Diagram Render Tests', () => {
  describe('fixtures', () => {
    it('renders the analytics-app fixture byte for byte', () => {
      // Arrange
      const diagram = parseDiagram(JSON.parse(readFixture('analytics-app', 'json')))
      const expected = readFixture('analytics-app', 'txt')

      // Act
      const output = render(diagram)

      // Assert
      assertEquals(output, expected)
    })

    it('renders the database-networking-deploy fixture byte for byte', () => {
      // Arrange
      const diagram = parseDiagram(JSON.parse(readFixture('database-networking-deploy', 'json')))
      const expected = readFixture('database-networking-deploy', 'txt')

      // Act
      const output = render(diagram)

      // Assert
      assertEquals(output, expected)
    })

    it('renders the database-networking-runtime fixture byte for byte', () => {
      // Arrange
      const diagram = parseDiagram(JSON.parse(readFixture('database-networking-runtime', 'json')))
      const expected = readFixture('database-networking-runtime', 'txt')

      // Act
      const output = render(diagram)

      // Assert
      assertEquals(output, expected)
    })

    it('renders the domain-tls fixture byte for byte', () => {
      // Arrange
      const diagram = parseDiagram(JSON.parse(readFixture('domain-tls', 'json')))
      const expected = readFixture('domain-tls', 'txt')

      // Act
      const output = render(diagram)

      // Assert
      assertEquals(output, expected)
    })

    it('renders the edge-tunnel fixture byte for byte', () => {
      // Arrange
      const diagram = parseDiagram(JSON.parse(readFixture('edge-tunnel', 'json')))
      const expected = readFixture('edge-tunnel', 'txt')

      // Act
      const output = render(diagram)

      // Assert
      assertEquals(output, expected)
    })

    it('renders the event-driven fixture byte for byte', () => {
      // Arrange
      const diagram = parseDiagram(JSON.parse(readFixture('event-driven', 'json')))
      const expected = readFixture('event-driven', 'txt')

      // Act
      const output = render(diagram)

      // Assert
      assertEquals(output, expected)
    })

    it('renders the event-driven-postgres fixture byte for byte', () => {
      // Arrange
      const diagram = parseDiagram(JSON.parse(readFixture('event-driven-postgres', 'json')))
      const expected = readFixture('event-driven-postgres', 'txt')

      // Act
      const output = render(diagram)

      // Assert
      assertEquals(output, expected)
    })

    it('renders the waiting-page fixture byte for byte', () => {
      // Arrange
      const diagram = parseDiagram(JSON.parse(readFixture('waiting-page', 'json')))
      const expected = readFixture('waiting-page', 'txt')

      // Act
      const output = render(diagram)

      // Assert
      assertEquals(output, expected)
    })
  })

  describe('layout rules', () => {
    it('anchors each name four columns left of its lifeline, the first at column 2', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['Build pipeline', 'Postgres DB'], rows: [] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  Build pipeline    Postgres DB',
        '      |                 |',
        '      |                 |',
        '',
      ])
    })

    it('keeps four spaces between adjacent names by widening the gap past its arrows', () => {
      // Arrange
      const name = 'A very long participant name'
      const diagram = parseDiagram({ participants: [name, 'B'], rows: [{ from: name, to: 'B', label: 'x' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A very long participant name    B',
        '      |                               |',
        '      |--- x ------------------------>|',
        '      |                               |',
        '',
      ])
    })

    it('lets a name run past its own lifeline when an arrow sets a wider gap', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['Alpha Beta', 'B'], rows: [{ from: 'Alpha Beta', to: 'B', label: 'HTTPS' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  Alpha Beta       B',
        '      |                |',
        '      |--- HTTPS ----->|',
        '      |                |',
        '',
      ])
    })

    it('draws at least three dashes before a label and five plus the head after it', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [
          { from: 'A', to: 'B', label: 'HTTPS' },
          { from: 'B', to: 'A', label: 'HTTPS' },
          { from: 'B', to: 'A', label: 'HTTPS', style: 'double' },
        ],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A                B',
        '      |                |',
        '      |--- HTTPS ----->|',
        '      |                |',
        '      |<--- HTTPS -----|',
        '      |<=== HTTPS =====|',
        '      |                |',
        '',
      ])
    })

    it('widens a gap for an arrow annotation longer than its arrow, starting it under the label', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [{ from: 'A', to: 'B', label: 'temp IPv4', annotation: 'runner IP appended' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A                          B',
        '      |                          |',
        '      |--- temp IPv4 ----------->|',
        '      |    runner IP appended    |',
        '      |                          |',
        '',
      ])
    })

    it('starts an annotation under a leftward arrow at its label, one column further right', () => {
      // Arrange
      const proxy = 'Edge proxy (region a)'
      const diagram = parseDiagram({
        participants: ['CDN (edge)', proxy],
        rows: [{ from: proxy, to: 'CDN (edge)', label: 'outbound tunnel', style: 'double', annotation: '(edge proxy tunnel)' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  CDN (edge)                   Edge proxy (region a)',
        '      |                            |',
        '      |<=== outbound tunnel =======|',
        '      |     (edge proxy tunnel)    |',
        '      |                            |',
        '',
      ])
    })

    it('starts an annotation under a self stub at the stub text', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [{ at: 'B', text: 'schema.parse()', annotation: '(validates)' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A    B',
        '      |    |',
        '      |    |-- schema.parse()',
        '      |    |   (validates)',
        '      |    |',
        '',
      ])
    })

    it('widens a gap for a self stub annotation longer than its stub', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [{ at: 'A', text: 'go', annotation: 'a much longer annotation' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A                               B',
        '      |                               |',
        '      |-- go                          |',
        '      |   a much longer annotation    |',
        '      |                               |',
        '',
      ])
    })

    it('widens each gap so its note, stub, label, and off-diagram target end four columns before the next lifeline', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B', 'C'],
        rows: [
          { from: 'A', to: 'B', label: 'go', note: 'a note far longer than the gap' },
          { at: 'A', text: 'a self stub far longer than the gap' },
          { at: 'A', annotation: 'a label far longer than the gap' },
          { from: 'A', label: 'poll', target: 'a target far off the diagram' },
          { from: 'B', to: 'C', label: 'on' },
        ],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A                                             B                                   C',
        '      |                                             |                                   |',
        '      |--- go ------------------------------------->| a note far longer than the gap    |',
        '      |-- a self stub far longer than the gap       |                                   |',
        '      |                                             |                                   |',
        '      |   a label far longer than the gap           |                                   |',
        '      |--- poll --> a target far off the diagram    |                                   |',
        '      |                                             |                                   |',
        '      |                                             |--- on --------------------------->|',
        '      |                                             |                                   |',
        '',
      ])
    })
  })

  describe('blank rows', () => {
    it('inserts a blank row before a message whose source is neither the previous source nor target', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B', 'C'],
        rows: [{ from: 'A', to: 'B', label: 'go' }, { from: 'C', to: 'B', label: 'back' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A             B               C',
        '      |             |               |',
        '      |--- go ----->|               |',
        '      |             |               |',
        '      |             |<--- back -----|',
        '      |             |               |',
        '',
      ])
    })

    it('inserts a blank row before a message that reverses direction', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [
          { from: 'A', to: 'B', label: 'go' },
          { from: 'B', to: 'A', label: 'back' },
          { from: 'A', to: 'B', label: 'again' },
        ],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A                B',
        '      |                |',
        '      |--- go -------->|',
        '      |                |',
        '      |<--- back ------|',
        '      |                |',
        '      |--- again ----->|',
        '      |                |',
        '',
      ])
    })

    it('keeps the arrow before a self stub as the one a later message is compared with', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [{ from: 'A', to: 'B', label: 'go' }, { at: 'B', text: 'work' }, { from: 'B', to: 'A', label: 'back' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A               B',
        '      |               |',
        '      |--- go ------->|',
        '      |               |-- work',
        '      |               |',
        '      |<--- back -----|',
        '      |               |',
        '',
      ])
    })

    it('inserts no blank row before a self stub that follows an annotated arrow', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [{ from: 'A', to: 'B', label: 'go', annotation: '(why)' }, { at: 'B', text: 'work' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A             B',
        '      |             |',
        '      |--- go ----->|',
        '      |    (why)    |',
        '      |             |-- work',
        '      |             |',
        '',
      ])
    })

    it('inserts a blank row before a standalone label', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [{ from: 'A', to: 'B', label: 'go' }, { at: 'A', annotation: 'valid?' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A             B',
        '      |             |',
        '      |--- go ----->|',
        '      |             |',
        '      |   valid?    |',
        '      |             |',
        '',
      ])
    })

    it('never stacks two blank rows, including directly after the header', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B', 'C'],
        rows: [{ at: 'A', annotation: 'first' }, { from: 'A', to: 'B', label: 'go' }, { from: 'C', to: 'B', label: 'back' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A             B               C',
        '      |             |               |',
        '      |   first     |               |',
        '      |--- go ----->|               |',
        '      |             |               |',
        '      |             |<--- back -----|',
        '      |             |               |',
        '',
      ])
    })

    it('inserts a blank row before a message that follows an arrow or stub annotation, not a standalone label', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [
          { from: 'A', to: 'B', label: 'temp IPv4', annotation: 'runner IP appended' },
          { from: 'A', to: 'B', label: 'config push' },
          { at: 'B', text: 'work', annotation: '(slow)' },
          { from: 'B', label: 'poll', target: 'Clock' },
          { at: 'B', annotation: 'ready?' },
          { from: 'B', to: 'A', label: 'reply' },
        ],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A                          B',
        '      |                          |',
        '      |--- temp IPv4 ----------->|',
        '      |    runner IP appended    |',
        '      |                          |',
        '      |--- config push --------->|',
        '      |                          |-- work',
        '      |                          |   (slow)',
        '      |                          |',
        '      |                          |--- poll --> Clock',
        '      |                          |',
        '      |                          |   ready?',
        '      |<--- reply ---------------|',
        '      |                          |',
        '',
      ])
    })

    it('treats an off-diagram target as a rightward arrow from its lifeline', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [
          { from: 'A', to: 'B', label: 'go' },
          { from: 'B', label: 'poll', target: 'Clock' },
          { from: 'B', to: 'A', label: 'back' },
        ],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A               B',
        '      |               |',
        '      |--- go ------->|',
        '      |               |--- poll --> Clock',
        '      |               |',
        '      |<--- back -----|',
        '      |               |',
        '',
      ])
    })

    it('keeps a standalone label on its own row before a message in another gap', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B', 'C'],
        rows: [{ at: 'A', annotation: 'valid?' }, { from: 'B', to: 'C', label: 'go' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A             B             C',
        '      |             |             |',
        '      |   valid?    |             |',
        '      |             |--- go ----->|',
        '      |             |             |',
        '',
      ])
    })
  })

  describe('arrows', () => {
    it('draws a rightward arrow on the target lifeline, between a blank row after the header and one at the end', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['A', 'B'], rows: [{ from: 'A', to: 'B', label: 'go' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, ['  A             B', '      |             |', '      |--- go ----->|', '      |             |', ''])
    })

    it('draws a leftward arrow with the head on the target lifeline', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['A', 'B'], rows: [{ from: 'B', to: 'A', label: 'go' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, ['  A             B', '      |             |', '      |<--- go -----|', '      |             |', ''])
    })

    it('draws a double arrow with equals signs', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['A', 'B'], rows: [{ from: 'B', to: 'A', label: 'go', style: 'double' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, ['  A             B', '      |             |', '      |<=== go =====|', '      |             |', ''])
    })

    it('widens the gap to the longest label so no arrow truncates', () => {
      // Arrange
      const diagram = parseDiagram({
        participants: ['A', 'B'],
        rows: [{ from: 'A', to: 'B', label: 'go' }, { from: 'A', to: 'B', label: 'a much longer label' }],
      })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A                              B',
        '      |                              |',
        '      |--- go ---------------------->|',
        '      |--- a much longer label ----->|',
        '      |                              |',
        '',
      ])
    })

    it('rejects a message between non-adjacent participants, naming the row', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['A', 'B', 'C'], rows: [{ from: 'A', to: 'C', label: 'skip' }] })

      // Act & Assert
      assertThrows(() => render(diagram), CliError, 'row 1 sends "skip" between non-adjacent participants')
    })
  })

  describe('notes and annotations', () => {
    it('places the note of a rightward arrow one space after the right-hand lifeline, its target', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['A', 'B'], rows: [{ from: 'A', to: 'B', label: 'go', note: 'done' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A             B',
        '      |             |',
        '      |--- go ----->| done',
        '      |             |',
        '',
      ])
    })

    it('places the note of a leftward arrow one space after the right-hand lifeline, its sender', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['A', 'B'], rows: [{ from: 'B', to: 'A', label: 'go', note: 'done' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, [
        '  A             B',
        '      |             |',
        '      |<--- go -----| done',
        '      |             |',
        '',
      ])
    })

    it('draws a self row as a stub on its own lifeline', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['A', 'B'], rows: [{ at: 'B', text: 'think' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, ['  A    B', '      |    |', '      |    |-- think', '      |    |', ''])
    })

    it('draws a standalone annotation under its lifeline, four columns in', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['A', 'B'], rows: [{ at: 'A', annotation: 'valid?' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, ['  A             B', '      |             |', '      |   valid?    |', '      |             |', ''])
    })

    it('renders an off-diagram target on the from lifeline', () => {
      // Arrange
      const diagram = parseDiagram({ participants: ['A', 'B'], rows: [{ from: 'B', label: 'for await', target: 'Consumer' }] })

      // Act
      const lines = render(diagram).split('\n')

      // Assert
      assertEquals(lines, ['  A    B', '      |    |', '      |    |--- for await --> Consumer', '      |    |', ''])
    })
  })
})
