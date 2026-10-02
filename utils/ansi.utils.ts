// Matches an ANSI colour escape sequence, so the escape byte the lint objects to is the match.
// deno-lint-ignore no-control-regex
export const ansiPattern = /\x1b\[[0-9;]*m/g

// Matches the cursor moves and erases a watcher writes to repaint its line, which read as `[0G[2K[J`.
// deno-lint-ignore no-control-regex
export const cursorPattern = /\x1b\[[0-9;]*[A-HJKSTf]/g

export const stripAnsi = (text: string): string => text.replaceAll(ansiPattern, '')

export const stripCursorCodes = (text: string): string => text.replaceAll(cursorPattern, '')
