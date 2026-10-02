# log

## What it does

Tails a log file and filters its lines by logtape level and category.

The tool runs `tail`, with `-n +1` to read the whole file when it is not following and a bare `-f` when it is.
Those two forms behave the same under GNU, BSD, and busybox tail, where starting a follow at zero lines does not.

Filtering reads the logtape header at the start of each line: a timestamp to the millisecond, a three-letter level token such as `WRN`, and the category.
Color escapes and the cursor moves a watcher writes to repaint its line are stripped before the header is read.
A line carrying no recognizable header passes through untouched, so stack traces, watcher messages, and raw stderr stay visible under any filter.
A line whose level token is not one logtape writes passes as well, since the tool cannot rank it against the level asked for.

A project names its logs in the `log` section of its `tools.config.json`, mapping each service name to the file that service writes.
The names live in that file rather than in flags because they are fixed setup, so a call names a service rather than repeating its path.
The tool writes no service into its own defaults, since every name and path belongs to the project.
A file outside that list is read by path instead, and a project with no section can still read any file that way.

The level and category parsing and the argument checks sit in `parse.ts`, and the config section and path choice in `config.ts`, both tested without permissions.
`main.ts` holds the CLI dispatch, the config read, and the tail spawn.

## Unsupported

**Finding a logtape header anywhere but the start of a line.**
A repaint can splice a progress fragment onto the front of a header, leaving a line the filter reads as headerless and passes through.
Matching a header mid-line would fix those few and misread every message that merely quotes a timestamp and three capital letters, so the line passes instead.

## Common issues

**"Log file not found"** for a service that is running.
The path in the `log` section differs from the file the service writes, or the process that writes the file has not started since the file was removed.
Point the service at the file it writes, or start the process that writes it.

**Lines from a gprocs log overwrite the ones above them.**
gprocs writes the cursor moves a watcher uses to repaint its own line into the log file, and a terminal carries them out again.
Pipe the output through `cat -v`, or read the proc with the procs tool, which strips them.
