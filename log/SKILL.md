---
name: log
description: Tails a project's log file, or prints it once, keeping only the logtape lines at or above a level or whose category contains a substring. Use when asked to watch, follow, tail, or filter a dev server or service log, to find recent warnings or errors in one, or to narrow a log to one category, instead of bare tail -f.
---

Rule: run the tool as `deno task --config <path to scratch>/deno.json log [flags]` from the project's root instead of bare `tail -f`
Reason: the tool reads the `tools.config.json` in the directory `deno task` was called from and resolves relative log paths against it, so a call from anywhere else reads another directory's settings

Rule: name the project's logs in its `tools.config.json` under `log`, as `{ "log": { "services": { "server": "logs/server.log" }, "defaultService": "server" } }`
Reason: `--service` reads from `services`, which maps each name to the file that service writes, and the tool has no service names of its own

Rule: write each service's path relative to the project root or as an absolute path
Reason: a relative path resolves against the directory the task was called from, which is the project's root when the tool is run as above

Rule: set `defaultService` to the service a run reads without `--service`
Reason: the tool refuses to guess when neither names a service, and lists the configured ones

Rule: expect a key the section does not define, such as a misspelled `default_service`, to be refused with the key named
Reason: the tool reads only `services` and `defaultService`, so a misspelling cannot pass as an absent setting

Rule: pass `--service <name>` (`-s`) to read a service other than the `defaultService`
Reason: an unknown name is refused with the configured ones listed, and an empty value is refused rather than falling back to the default

Rule: name the service with `--service`, never as a bare word after the task
Reason: the tool refuses a positional argument rather than reading the default service as though none was named

Rule: pass `--file <path>` (`-f`) to read a file outside the `services` list, and never alongside `--service`
Reason: the path resolves from the directory the task was called from, it needs no `log` section, and the tool refuses the two flags together rather than picking one

Rule: pass `--no-follow` to print the existing file once and exit
Reason: omitted, the tool tails forever and blocks the terminal

Rule: do not pass `--no-follow` when watching live activity
Reason: live tailing is the default, which first prints the file's last 10 lines that pass the filters and then follows it

Rule: pass `--level <level>` (`-l`) to show only one level and above
Reason: valid values are trace, debug, info, warn, error, fatal, and any other value is refused

Rule: pass `--cat <substring>` (`-c`) to show only lines whose category contains the substring
Reason: a category such as `app·middleware·tarpit` is filterable by any segment of it, and an empty value is refused because it would match every line

Rule: combine `--level` and `--cat` to narrow further
Reason: the filters apply with logical AND

Rule: pipe a log whose lines carry no logtape header through `grep` instead of passing `--level` or `--cat`
Reason: a line the filter cannot read passes untouched, so both filters pass every line of such a log

Rule: reach for this tool to follow a log live or to filter it by level or category, and for the procs tool's `logs` command to print a gprocs proc's recent output once
Reason: this tool tails and filters logtape lines, while procs prints a snapshot of a proc by name

Rule: consume the output as plain text, one log line per output line
Reason: the tool strips color escapes only to read each header and prints the original colored line, so `grep` and `awk` work on it and a terminal shows its colors

Rule: expect the kept lines on stdout and errors on stderr
Reason: a caller piping the output gets the log lines alone

Rule: read the end of the output when looking for recent events
Reason: a log is append-only with the oldest entries at the top, so piping `--no-follow` through `tail -N` shows what just happened

Rule: pass `--help` (`-h`) to print the usage block
Reason: lists every option without leaving the terminal
