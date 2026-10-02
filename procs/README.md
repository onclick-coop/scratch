# procs

## What it does

Reads and controls the procs a running gprocs session supervises.
gprocs is an mprocs-compatible process runner, so a session is one gprocs process running one mprocs config.

Reading goes to the file gprocs writes for the proc under its `--log-dir`, so it never moves which proc the pane shows.
The tool prints the tail of that file with the cursor moves and erases a watcher writes to repaint its line stripped out, and keeps color escapes.

Acting names the proc on the control command itself, so nothing can change the target between choosing it and acting on it.
The tool sends the command with `gprocs --ctl` to the control server the session's mprocs config declares under `server:`, reading the port from that same file so a run cannot target a listener the session never opened.
The proc name goes out as a yaml double-quoted scalar, so a name carrying a colon cannot close the mapping key and change what the command says.

The tool checks the name against the session's mprocs config before sending anything.
This is load-bearing rather than a convenience: gprocs resolves an action carrying no name to whichever proc is currently selected, so a command that lost its name would act on whatever the pane happens to be showing.
A name that matches no proc is harmless by comparison, since gprocs resolves it to nothing.

A project declares its sessions in the `procs` section of its `tools.config.json`.
Each session names its mprocs config and, where gprocs runs it with one, its log directory.
The sessions live in that file rather than in flags because they are fixed setup: declaring a session once keeps every call down to a command and a proc name, where flags would have to repeat the config and log directory on each call and could pair one session's config with another's logs.
The tool writes no session into its own defaults, since the session names, config paths, and log directory all belong to the project.
A session without a log directory suits a gprocs run without `--log-dir`, such as one whose panes are TUIs whose files would capture screen redraws rather than output.

The pure logic sits in modules that test without permissions: command building and name quoting in `action.ts`, mprocs config reading, the log path, and log tailing in `config.ts`, the `tools.config.json` section in `sessions.ts`, and the schemas for both files in `schema.ts`.
`main.ts` holds the CLI dispatch, the file reads, and the gprocs spawn.

## Unsupported

**Listing which procs are up.**
The status lives only in the gprocs UI, where the tool cannot read it.

**Marking which procs are set not to autostart.**
`list` prints names, and the mprocs config is where a proc's `autostart` setting lives.

## Common issues

**"tools.config.json configures no procs sessions"** from a project that has sessions.
The call came from a directory other than the project's root, such as a subdirectory or the scratch repo itself.
Call it again from the project's root.

**"The mprocs config has a shape the tool cannot read"** on a config gprocs runs.
The tool reads `procs` as a mapping keyed by proc name, so a list of procs or a file that is not a mapping has no names to read.
Write `procs` as a mapping, as mprocs documents it.

**"gprocs refused the command"** after the name was accepted.
Nothing is listening on the port the session's mprocs config names under `server:`, usually because the session is not running or its gprocs was started from another config.
Start the session with the config its `config` key names.
