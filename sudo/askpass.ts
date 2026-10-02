// Each script embeds these inside shell and AppleScript quotes, so neither may hold a quote mark.
const PROMPT = 'Password for sudo'
const TITLE = 'sudo'

const MAC_ASKPASS = [
  '#!/bin/sh',
  `exec osascript -e 'display dialog "${PROMPT}" default answer "" with hidden answer with title "${TITLE}"' -e 'text returned of result'`,
  '',
].join('\n')

const LINUX_ASKPASS = [
  '#!/bin/sh',
  'set -e',
  `prompt='${PROMPT}'`,
  'if command -v ssh-askpass >/dev/null 2>&1; then',
  '  exec ssh-askpass "$prompt"',
  'elif command -v zenity >/dev/null 2>&1; then',
  `  exec zenity --password --title="${TITLE}" --text="$prompt"`,
  'elif command -v kdialog >/dev/null 2>&1; then',
  `  exec kdialog --password "$prompt" --title "${TITLE}"`,
  'else',
  "  trap 'stty echo </dev/tty' EXIT",
  "  trap 'exit 130' INT",
  "  trap 'exit 143' TERM",
  '  printf "%s: " "$prompt" >/dev/tty',
  '  stty -echo </dev/tty',
  '  IFS= read -r pw </dev/tty',
  '  stty echo </dev/tty',
  '  printf "\\n" >/dev/tty',
  '  printf "%s\\n" "$pw"',
  'fi',
  '',
].join('\n')

// Picks an osascript dialog on macOS and a chain of helpers on every other platform.
export const askpassScript = (os: typeof Deno.build.os): string => {
  if (os === 'darwin') return MAC_ASKPASS

  return LINUX_ASKPASS
}
