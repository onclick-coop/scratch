# scratch

Small command-line tools written in Deno for miscellaneous tasks.

These tools aren't general enough to belong in [tools](https://github.com/onclick-coop/tools).
The repo is public, and you're welcome to use them.

## Tools

| Tool | What it does |
| --- | --- |
| [color-scale](color-scale/) | Measures a Tailwind color scale in OKLCH and extrapolates new stops on its curve |
| [log](log/) | Tails a log file, filtering its logtape lines by level and category |
| [mutate](mutate/) | Breaks one behavior at a time from a hand-written plan and names the ones a test suite never notices |
| [playwright-debug](playwright-debug/) | Keeps a headed Playwright chromium open and runs driver scripts against it over CDP |
| [procs](procs/) | Prints a gprocs proc's recent log and restarts, starts, stops, or kills it by name |
| [sequence-diagram](sequence-diagram/) | Renders a sequence diagram described as JSON into an ASCII layout for a markdown doc |
| [shiki-zed-parity](shiki-zed-parity/) | Keeps a Shiki theme matched to Zed's One Dark, character by character |
| [sudo](sudo/) | Runs a command through sudo with a password prompt that needs no terminal |
| [test-report](test-report/) | Runs a Deno test suite one file at a time and writes each failure's full output to a markdown report |
| [tmux](tmux/) | Reads the panes of a tmux session and drives windows of its own there, refusing to write to anyone else's |
| [todo](todo/) | Keeps a markdown checklist of todos in sections, adding, checking, editing, and removing items by index |
| [trpc](trpc/) | Calls a procedure on any tRPC server and prints its result as JSON |

## Usage

Clone the repo and run a tool by name from its root:

```sh
deno task <name>
```

To run a tool on another project, call it from that project's root:

```sh
deno task --config <path to scratch>/deno.json <name>
```

A tool reads relative paths and the project's `tools.config.json` from the directory it is called from.
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
