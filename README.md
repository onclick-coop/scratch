# scratch

Small command-line tools written in Deno for miscellaneous tasks.

These tools aren't general enough to belong in [tools](https://github.com/onclick-coop/tools).
The repo is public, and you're welcome to use them.

## Tools

| Tool | What it does |
| --- | --- |
| [color-scale](color-scale/) | Measures a Tailwind color scale in OKLCH and extrapolates new stops on its curve |
| [shiki-zed-parity](shiki-zed-parity/) | Keeps a Shiki theme matched to Zed's One Dark, character by character |
| [tmux](tmux/) | Reads the panes of a tmux session and drives windows of its own there, refusing to write to anyone else's |

## Usage

Clone the repo and run a tool by name from its root:

```sh
deno task <name>
```

A tool's own README lists anything else it needs.

## Structure

```
deno.json              workspace members, and each tool's task and permissions
deno.lock              one lockfile shared by every tool
tools.config.json      this repo's settings for each tool, keyed by tool name
utils/                 helpers shared across tools
<name>/
  deno.json            the tool's own dependencies
  main.ts              entry point
  <part>.ts            pure logic, such as parsing or rows
  <part>.test.ts
  commands/<verb>.ts   one file per verb, for tools with several
  SKILL.md             how agents use the tool
  README.md            what it does, what it won't, and common issues
```
