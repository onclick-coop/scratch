import type { Command, Outcome } from './schema.ts'

const BOM = '\u{FEFF}'

// Matches a line feed with no carriage return before it, which marks a file as not wholly CRLF.
export const bareLineFeedPattern = /(?<!\r)\n/

// Runs a command past any byte-order mark and in line feeds, writing back the file's own.
export const runOnFile = (command: Command, argv: string[], raw: string): Outcome => {
  const bom = raw.startsWith(BOM) ? BOM : ''
  const body = raw.slice(bom.length)
  const isCrlf = body.includes('\r\n') && !bareLineFeedPattern.test(body)
  const text = isCrlf ? body.replaceAll('\r\n', '\n') : body

  const { text: next, output } = command(argv, text)
  if (next === text) return { text: raw, output }

  const written = isCrlf ? next.replaceAll('\n', '\r\n') : next

  return { text: `${bom}${written}`, output }
}
