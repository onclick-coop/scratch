import { assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { askpassScript } from './askpass.ts'

const linuxScript = [
  '#!/bin/sh',
  'set -e',
  "prompt='Password for sudo'",
  'if command -v ssh-askpass >/dev/null 2>&1; then',
  '  exec ssh-askpass "$prompt"',
  'elif command -v zenity >/dev/null 2>&1; then',
  '  exec zenity --password --title="sudo" --text="$prompt"',
  'elif command -v kdialog >/dev/null 2>&1; then',
  '  exec kdialog --password "$prompt" --title "sudo"',
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

describe('All Sudo Askpass Tests', () => {
  describe('askpassScript', () => {
    it('shows an osascript password dialog on macOS', () => {
      // Arrange
      const expected = [
        '#!/bin/sh',
        `exec osascript -e 'display dialog "Password for sudo" default answer "" with hidden answer with title "sudo"' -e 'text returned of result'`,
        '',
      ].join('\n')

      // Act
      const script = askpassScript('darwin')

      // Assert
      assertEquals(script, expected)
    })

    it('tries ssh-askpass, zenity, and kdialog, then reads the tty with echo restored on any exit, on Linux', () => {
      // Act & Assert
      assertEquals(askpassScript('linux'), linuxScript)
    })

    it('uses the same chain on every other platform except macOS', () => {
      // Act & Assert
      assertEquals(askpassScript('freebsd'), linuxScript)
    })
  })
})
