---
name: tmux
description: Prints the panes of a tmux session and lists its windows, and creates, splits, types into, and kills windows of its own there while refusing to write to any window it did not create. Use when reading what a tmux window or pane shows, such as a dev server, a TUI, or a shell, or when an agent needs a window of its own to run a command in, instead of raw tmux capture-pane or send-keys.
---

Rule: run the tool from a project's root as `deno task --config <path to scratch>/deno.json tmux <command>` instead of raw `tmux capture-pane` or `send-keys`
Reason: the tool reads the `tools.config.json` in the directory the task is called from, resolves window names, and names the known windows when a target is wrong

Rule: set the session a project reaches in the `tmux` section of its `tools.config.json`, as `{ "tmux": { "session": "dev", "start": "./start.sh" } }`
Reason: the tool has no default session, since which session to reach belongs to the project

Rule: give the `tmux` section only `session` and `start`, each a non-empty string, and leave out either one the project has no use for
Reason: the tool refuses a misspelled key or an empty value rather than running as though the setting were absent

Rule: pass `--session <name>` (`-s`) to reach a session other than the configured one
Reason: the flag overrides the config, the tool refuses an empty value, and it refuses to run when neither names a session

Rule: print a pane with `read`, which is also what runs when no command is given
Reason: reading is the common case, so `tmux -w ops` needs no command word

Rule: list the session's windows and panes with `list`, one line per pane
Reason: each line opens with `*` on the active pane or a space elsewhere, then a space, then `<window>.<pane>`, the window name, and `(<command>)` separated by tabs, with ` [owned]` after a window this tool created

Rule: pass `--window <target>` (`-w`) to pick a window by name or index, optionally as `<window>.<pane>`
Reason: a name, an index, and an explicit pane all resolve, and the pane defaults to 0

Rule: omit `--window` on a read to capture the session's active pane
Reason: convenient when reading whatever window is currently focused

Rule: pass `--window` on `split`, `send`, and `kill`, which otherwise resolve the session's active pane
Reason: the ownership check refuses that pane rather than writing to it, but a write aimed at nothing is still aimed at the wrong place

Rule: pass `--lines <n>` (`-n`) on `read` to change how much scrollback prints, which defaults to 200 lines
Reason: the other commands refuse the flag rather than ignoring it

Rule: write `--lines` as plain digits between one and a million
Reason: the tool refuses zero, an empty value, a hex or exponent literal, and anything past a million alike, since each is a typo rather than a line count

Rule: do not pass `-a` to a hand-rolled `capture-pane` expecting a full-screen program's output
Reason: plain `capture-pane` reads whichever buffer the pane is on and so already returns the running program's screen, while `-a` reads the other buffer and returns the shell scrollback from before that program started

Rule: create a window to work in with `new <name>`, which names it `claude-<name>` and prints that name
Reason: the prefix shows in `list` as `[owned]` so the user can see at a glance which windows are the agent's

Rule: name a new window with lowercase letters, digits, and dashes only
Reason: the tool refuses anything else, and a `.` or `:` would read as a tmux target separator rather than part of the name

Rule: pass the printed `claude-` name back as `--window` to act on the window just created
Reason: `new` prints the prefixed name, so passing it straight back is the whole contract

Rule: expect `new` to fail when a window of that name already exists, rather than reusing it
Reason: reusing a window would inherit whatever is running in it, so the tool makes the collision visible

Rule: expect a window from `new` to open in the directory the task is called from
Reason: a command sent into it runs there, rather than wherever the tmux client was started

Rule: split a pane in an owned window with `split`, which splits the resolved pane and leaves focus where it was
Reason: the new pane inherits the window's ownership, so it is writable without being tagged again

Rule: run `list` after `split` to learn the new pane's index
Reason: the tool prints nothing about the pane it created

Rule: type into an owned pane with `send <text>`, which sends the text literally and then presses Enter
Reason: the text runs as a command the moment it arrives, and there is no way to type without submitting

Rule: pass one line at a time to `send`, never a multi-line block
Reason: an embedded newline arrives as a literal Enter, so a block of N lines runs as N commands

Rule: do not pass a key name such as `C-c` to `send` expecting it to interrupt
Reason: the text goes out literally, so a key name arrives as its characters rather than as the keystroke

Rule: put `--window` before `--` when sending text that starts with a dash, as `send -w claude-x -- "-n 5"`
Reason: everything after `--` is text rather than options, so a flag written after it is typed into the pane instead of naming the target

Rule: remove an owned window with `kill`, which kills the whole window rather than the resolved pane
Reason: the target is the window the pane belongs to, so a `--window claude-x.1` kill removes pane 0 with it

Rule: kill an owned window once its work is done rather than leaving it in the session
Reason: the user's window list is their workspace, so an agent's scratch windows are litter after the fact

Rule: read any window in any session freely, since the ownership check applies only to `split`, `send`, and `kill`
Reason: reading changes nothing, so the tool never refuses it

Rule: expect every write command to refuse a window the tool did not create, naming the window and the action
Reason: the check requires both the `claude-` name and the `@claude-owned` window option that `new` sets, so every window the user made stays read-only however it is addressed

Rule: do not attempt to write to a user's window by renaming it to the `claude-` prefix
Reason: a renamed window carries no `@claude-owned` option, so it still fails the check

Rule: expect a `claude-` window left by an earlier session to still be owned, and prefer `new` over writing to one
Reason: the option lives on the window rather than the session, so a window this run never created can still pass the check

Rule: address a window by its index when two windows share a name, which the tool refuses rather than guessing between
Reason: acting on either would mean acting on a window the caller did not choose

Rule: expect a non-zero exit with the known windows when the target window does not exist, and with the available pane indexes when the window has no such pane
Reason: the tool lists what the session actually holds so the correct target is one edit away

Rule: expect a missing-session error to mean the session is not running, and to name the configured `start` command when the session came from the config
Reason: the tool reads a session it does not create, so an absent session is the first failure a caller meets

Rule: expect the pane, the listing, and the name from `new` on stdout, and errors and an empty pane's notice on stderr
Reason: a genuinely empty pane and an unreadable one look identical on stdout, so the reason goes where it will not pollute a pipe

Rule: pass `--help` or `-h` to print the usage block
Reason: lists the commands, the target forms, and the options without leaving the terminal
