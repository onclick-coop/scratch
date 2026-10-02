---
name: procs
description: Prints a proc's recent log output, lists a session's procs, and restarts, starts, stops, or kills one proc by name in a running gprocs (mprocs-compatible) session. Use when asked to show, check, tail, or inspect a dev proc, to say why one failed, or to restart or stop one, instead of reading or driving the gprocs pane.
---

Rule: treat this tool as the surface for a named proc in a gprocs session, reading a snapshot with `logs` and acting on it with an action command
Reason: a request naming a proc is a request this tool answers, so the gprocs pane never needs to come into it

Rule: run the tool as `deno task --config <path to scratch>/deno.json procs <command>` from the project's root
Reason: the tool reads the `tools.config.json` in the directory `deno task` was called from and resolves each session's paths against it, so a call from anywhere else reads another directory's settings

Rule: declare the project's sessions in its `tools.config.json` under `procs`, as `{ "procs": { "sessions": { "main": { "config": "mprocs.yaml", "logDir": "logs" } }, "defaultSession": "main" } }`
Reason: a session is the mprocs config gprocs runs plus the `--log-dir` it writes to, and the tool refuses to run until the section names at least one

Rule: set each session's `config` to the mprocs config its gprocs runs with `--config`, as a path relative to the project root or an absolute one
Reason: the tool reads the proc names and the control port from that file, so it has to be the file gprocs loaded

Rule: set a session's `logDir` to the directory its gprocs passes to `--log-dir`, and leave the key out for a session gprocs runs without one
Reason: `logs` reads `<logDir>/<proc>.log`, and a session without the key is refused on `logs` rather than read from a guessed path

Rule: set `defaultSession` to the session a run reaches without `--session`
Reason: the tool refuses to guess when neither names a session, and lists the configured ones

Rule: expect a key the section does not define, such as a misspelled `log_dir`, to be refused with the key named
Reason: the tool reads only `sessions` and `defaultSession`, and each session only `config` and `logDir`, so a misspelling cannot pass as an absent setting

Rule: read a proc's output with `procs logs <name>` whenever asked to show, check, tail, or inspect a proc, or to say why it failed
Reason: "show me that proc", "what is it doing", and "why did it fall over" all name a proc, and its log is where the answer is

Rule: follow a proc's output live by tailing `<logDir>/<proc>.log` with another tool
Reason: this tool prints a snapshot and exits

Rule: restart or stop a proc via `procs restart <name>` instead of sending keys to the gprocs pane
Reason: the tool names the proc on the control command, where driving the TUI means moving a shared selection that can change between the read and the keystroke

Rule: name the proc exactly as the mprocs config declares it
Reason: the name is checked against the config before anything is sent, so a typo is refused rather than acting on whatever is selected

Rule: write the command as a word, never as a flag
Reason: the tool refuses an unrecognized flag rather than absorbing it, so a mistyped `--logs` cannot fall through to an action

Rule: pass one command per run, since the commands are positions rather than flags
Reason: a flag set could carry a read and an action at once and silently drop one, where a position cannot

Rule: list the session's procs with `procs list`, which is also what runs when no command is given
Reason: the names come from the same config the tool validates against, so a listed name is always a valid argument

Rule: discover a session's procs with `list` rather than assuming which ones it holds
Reason: the list comes from the config the session actually runs, so it stays right as procs are added and renamed

Rule: choose among the actions `restart`, `force-restart`, `start`, `stop`, and `kill`
Reason: `stop` sends the configured stop signal and `kill` does not

Rule: do not send an action to a proc the user did not name in a session that runs deployment or secret-pushing scripts rather than servers
Reason: starting such a proc reaches production, and nothing in the tool tells those sessions apart

Rule: read a proc's config entry before acting on it when unsure what it runs
Reason: a proc set not to autostart is one nothing is meant to launch on its own, and `restart` launches a stopped proc

Rule: treat `logs` and `list` as the only commands that change nothing
Reason: `start` and `restart` launch a proc, `stop` and `kill` leave it down until something starts it again, and `restart` on a stopped proc starts it

Rule: pass `--lines <n>` (`-n`) to `logs` to change how much of the log prints
Reason: defaults to the last 200 lines, which is a screen or two, and every other command refuses the flag rather than ignoring it

Rule: write `--lines` as plain digits between one and a million
Reason: the tool refuses zero, an empty value, a hex or exponent literal, and anything past a million alike, since each is a typo rather than a line count

Rule: pass `--session <name>` (`-s`) to reach a session other than the `defaultSession`
Reason: each session has its own mprocs config and its own control port, and an unknown name is refused with the configured ones listed

Rule: quote a proc name carrying a space or colon
Reason: the shell would otherwise split it, and the tool would see a name no proc carries

Rule: pass `--help` (`-h`) to print the usage block
Reason: lists every command and option without leaving the terminal

Rule: expect the tool to report what it sent, never that the proc came back up
Reason: the gprocs control server answers nothing, so success means the command was accepted, not that the process is healthy

Rule: expect an action to print `sent <action> to <proc> in <session>` on stderr and nothing on stdout, while `logs` and `list` print to stdout
Reason: a caller piping the output gets the payload alone, so an empty stdout after an action is the contract rather than a failure

Rule: confirm a restart took effect by reading the same proc back with `logs`
Reason: the proc's own log is the only place the restarted process reports itself

Rule: confirm a restart by an identity in the proc's output that changes across restarts, such as a run id, a port binding, or a generated URL
Reason: an `UP` status shows the proc is running, not that it is the process the restart produced

Rule: give the proc time to start before reading it back, and treat an unchanged log as unconfirmed rather than as restarted
Reason: the send returns at once, so a read straight after it still shows the output of the process the restart replaced

Rule: expect a missing log file to mean the session has not run under gprocs since that proc last did, or that its `logDir` and its gprocs `--log-dir` name different directories
Reason: gprocs creates the file when the session starts, so the error names the path the tool looked for

Rule: give each session's mprocs config a `server: 127.0.0.1:<port>` key before sending it an action
Reason: gprocs binds its control listener from that key and the tool reads the port from the same file, so a config without it is refused with the fix named

Rule: restart gprocs after adding or changing a `server:` key
Reason: the listener binds once at startup, so a config edit alone changes nothing

Rule: do not send keystrokes to a gprocs pane to control a proc
Reason: the selection is shared state that moves between the read and the send, which is how one proc's restart becomes another's
