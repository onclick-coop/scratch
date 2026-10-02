# tagline

## What it does

Blocks a gh command that writes prose to GitHub unless that prose ends with the project's attribution tagline.
It runs as a Claude Code `PreToolUse` hook on Bash, so the check happens before the command runs rather than in review afterwards.

Claude Code hands the hook the pending tool call as JSON on stdin.
`shell.ts` reads the Bash command the way the shell would, into simple commands made of words with one layer of quoting removed.
It descends into command substitutions, backticks, subshells, and process substitutions.
Each command keeps its heredocs, its redirections, and the command piped into it, apart from its words.
Each word records whether a live expansion such as `$(...)`, `$VAR`, or an unquoted heredoc fills part of it at run time.
A `$(cat <<'EOF' ... EOF)` substitution is the one expansion it resolves, since its text is fixed when the command is written.

`command.ts` finds the command that actually runs, past variable assignments, reserved words such as `if` and `{`, and the wrappers `env`, `command`, `sudo`, `exec`, `timeout`, `nohup`, `nice`, `stdbuf`, `setsid`, and `time` with their options.
`parser.ts` reads the script of a `bash -c`, `sh -c`, `zsh -c`, or `eval` the same way, and skips gh's own options before the subcommand.
When xargs runs gh, its fixed arguments are read as gh's, and a replace string such as `{}` inside one makes that argument built at run time.

The subcommands checked are those that write prose people read: creating, editing, commenting on, closing, reopening, or reviewing issues and pull requests, and creating or editing releases.
Each has a table in `commandSpecs` naming the flags that carry its body and the short flags around them, so every spelling gh accepts is read, such as `-bhi`, `--body=hi`, and `-F path`.
The table is a closed list, so a subcommand gh adds later passes unchecked until it joins `commandSpecs`.
`gh gist create` is not on it, since a gist takes files and a description rather than a body.

`gh api` is checked when it sends a body to an issue, pull request, release, or commit comment endpoint.
It counts as a write unless its method is GET, because gh sends fields or an input file as a POST when no method is named.
A `body` field is read as text, as a file for `-F body=@path`, and from the JSON of an `--input` file, while other REST endpoints are left alone.
For `gh api graphql`, the tool reads the query from its field, its file, or the `--input` file, and blocks a query the shell builds at run time since it cannot tell whether that one is a mutation.

A body whose text the shell fills in at run time cannot be checked before the command runs.
The tool still passes one whose literal ending is already the tagline, since nothing the shell substitutes earlier can change the last line.

`writes.ts` walks the script in order, so a body file is checked as the gh command will find it rather than as it sits on disk before the script runs.
It follows `cd`, `pushd`, and `popd` to place relative paths, and records what each `>`, `>>`, `tee`, `cp`, or `mv` puts in a file.
The text is known only when it comes from `echo`, from `printf` using `%s` or `%b`, or from a heredoc or here-string that `cat` or `tee` passes on, and is otherwise treated as built at run time.
The walk is flat, so a `cd` inside a subshell or a `bash -c` script is read as lasting for the rest of the script.

An error inside the tool, past the setup problems it reports by name, is decided by `failClosed` in `hook.ts`, which falls back to looking for the word `gh` when even the parser failed.
Three failures happen before the tool runs, so it cannot catch them, and Claude Code lets the command through for each one.
They are deno missing from the hook's `PATH`, a lockfile that no longer matches under `--frozen`, and a hook that outlives its timeout.

The pure logic sits in modules that test without permissions: the shell reading in `shell.ts`, the command behind its prefixes in `command.ts`, finding gh and its body arguments in `parser.ts`, the script's directory and file writes in `writes.ts`, the body check and violation message in `checker.ts`, the config section in `config.ts`, the payload and `--input` shapes in `payload.ts`, and the decision for one call in `hook.ts`.
The hook and the checker take their config and file readers as arguments, so their tests pass readers over in-memory maps.
`main.ts` reads its flags, stdin, `CLAUDE_PROJECT_DIR`, the config, and body files.

## Unsupported

**A built-in tagline.**
The tagline is a project convention, and its wording records a decision such as whether the human or the model is credited, so any default would be one project's wording applied to every project that forgot to set its own.

**Checking the body of a GraphQL mutation.**
The body can sit in the query as a string with GraphQL escapes, in a variable, or in a file, and reading all three reliably is a GraphQL parser the REST commands make unnecessary.

**Finding gh behind contrived indirection.**
The tool does not follow `find -exec`, `env -S`, `builtin command`, a script fed to `bash` on stdin or from a file, gh named through a variable such as `$G`, or a shell function wrapping gh.
Each is a way to hide gh rather than a way to run it, and following them would need a shell interpreter rather than a reader.

## Common issues

**Every gh command runs unchecked, with a hook error saying "The lockfile is out of date".**
The scratch checkout's `deno.json` changed without its `deno.lock`, and `--frozen` refuses to run against a lockfile that no longer matches.
Run `deno install --frozen=false` in the scratch checkout, or pull a commit whose lockfile matches.
