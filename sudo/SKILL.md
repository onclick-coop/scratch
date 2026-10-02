---
name: sudo
description: Runs a command through sudo with a password prompt that needs no terminal, using the helper named by SUDO_ASKPASS or a built-in password dialog. Use when a privileged command, such as installing a package or editing a file under /etc, has to run from an agent, an editor task, or any other process with no tty, where bare sudo fails asking for a password.
---

Rule: run a privileged command via `deno task --config <path to scratch>/deno.json sudo <command> [args...]` from the project's root instead of bare `sudo <command>` when no terminal is attached
Reason: bare sudo reads its password from a tty, and the task gives sudo a prompt that needs none

Rule: pass the command and its arguments as separate words after the task name, never quoted together as one string
Reason: each word reaches `sudo -A --` as its own argument, so a quoted command is looked up as one program name

Rule: put the command first, since every flag after it goes to the command and a flag before it is refused, `-A` and `-S` included
Reason: the tool runs `sudo -A --` itself and takes no flag of its own but `--help`

Rule: pass a `--` the command needs after the command's name, as in `rm -- -file`, and put a `--` first only for a command whose name starts with a dash
Reason: a `--` after the command's name reaches the command unchanged, while a leading one ends the tool's own flags

Rule: write a relative path in the command relative to the directory the task was called from
Reason: the command runs there, although deno task runs the tool itself from the scratch repo root

Rule: unset `INIT_CWD` before calling the task from an npm script or anything else that sets it
Reason: deno task keeps a value already set, so the command would run in that directory instead of the caller's

Rule: set `SUDO_ASKPASS` to your own helper to have the task use it
Reason: sudo reads the same variable, so the task honours a value already set instead of writing its own helper

Rule: do not pipe a password into the task
Reason: stdin passes through to the command, so a piped password reaches the command rather than sudo

Rule: give a CI runner passwordless sudo for the exact commands it needs instead of calling this task from a pipeline
Reason: the prompt waits on a dialog or a terminal read that nobody answers, so an unattended job hangs until the runner times out

Rule: expect the task to exit with the command's own exit status, with its output on stdout and stderr as it printed it
Reason: the tool passes sudo's streams and exit code straight through, so a check such as `test -f` or a grep with no match keeps its meaning

Rule: read a line starting `error:` on stderr as a refusal by the tool itself, which then exits 1: a missing command, an unknown flag, or no `sudo` on `PATH`
Reason: sudo and the command can exit 1 as well, so the `error:` line is what marks the refusal as the tool's

Rule: expect a `warning:` line on stderr when the tool cannot remove its temporary helper directory, with the exit status still the command's
Reason: the command has already run by then, so the cleanup failure is reported without replacing its result

Rule: pass `--help` or `-h` before the command to print usage and exit 0
Reason: a `--help` after the command goes to the command

Rule: expect the task to run with `--allow-write`, `--allow-env=SUDO_ASKPASS,INIT_CWD`, and `--allow-run=sudo` alone
Reason: the tool writes its helper into a new temporary directory, reads two variables, and starts sudo and nothing else
