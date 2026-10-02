# sudo

## What it does

sudo asks for a password on the terminal it runs in, so a command started by an agent or an editor task, which has no terminal, fails at the prompt.
With `-A`, sudo instead runs the helper program named by `SUDO_ASKPASS` and reads the password from what the helper prints.
The tool runs `sudo -A -- <command>` with a helper set, so sudo asks through a dialog.

When the environment names no helper, the tool writes a helper script into a new temporary directory only the user can open, points sudo at it, and removes the directory once sudo exits.
On macOS the helper shows an osascript password dialog.
On every platform except macOS it tries ssh-askpass first, the helper sudo.conf gives as its example, then zenity, then kdialog.
With none of the three installed, it asks on the terminal with echo off, and turns echo back on however the read ends, Ctrl-C and Ctrl-D included.

The write permission covers any path, because the temporary directory moves with the platform and with `TMPDIR`, and a deno task cannot fall back to a default for an unset variable.
The command runs as root whatever the permissions say, so they bound only the tool's own steps.

## Unsupported

**A password taken from stdin, an argument, or an environment variable.**
The password goes only through a prompt that sudo calls, so it never lands in shell history, the process list, or the environment.

## Common issues

**`sudo: unable to run <path>: No such file or directory`.**
`SUDO_ASKPASS` in the environment names a helper that does not exist.
Point `SUDO_ASKPASS` at an executable helper, or unset it to get the built-in one.

**`cannot create /dev/tty` from the helper script on a platform other than macOS.**
None of ssh-askpass, zenity, or kdialog is installed, so the helper falls back to the terminal, and the process has none.
Install one of them, such as the distribution's `ssh-askpass` package.

**A password dialog on macOS where Touch ID was expected.**
Touch ID for sudo is a PAM setting that macOS leaves off, so sudo asks the helper for a password instead.
Copy `/etc/pam.d/sudo_local.template` to `/etc/pam.d/sudo_local` and uncomment `auth sufficient pam_tid.so`, which survives macOS updates where an edit to `/etc/pam.d/sudo` does not.
