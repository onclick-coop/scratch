# tmux

## What it does

Prints the panes of a tmux session, and creates, splits, types into, and kills windows of its own there.
An agent can watch a session and run commands in it without touching any window the user made.

Every target resolves to a tmux pane id before it reaches tmux, so the pane the ownership check approved is the pane the write lands on.
An index is reused by the next pane created and a name can belong to two windows at once, while tmux keeps an id unique for the life of the server.

The pane parsing and target resolution sit in `parse.ts`, the ownership check in `own.ts`, and the config section and session choice in `config.ts`, all tested without permissions.
`io.ts` runs tmux and `main.ts` holds the CLI dispatch.

## Unsupported

**No override for the ownership check.** A window worth writing to is a window worth creating with `new`, so no flag writes to a window the tool did not create.

## Common issues

**`--lines` shows no more than one screen.** A full-screen program draws on the alternate screen, which holds one screenful, so a pane running one has no scrollback to reach.
Raising `--lines` helps only on a pane running an ordinary shell, and a program that keeps a log is better read there.

**"Unknown option" on `--kill` or another write.** The writes are commands rather than flags.
Write `kill`, `split`, `send`, or `new` as the first word.
