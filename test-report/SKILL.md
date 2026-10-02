---
name: test-report
description: Runs a Deno test suite one file at a time, records each file as pass, fail, or crash, and writes a markdown report holding every failing file's full output, with reruns of only the failures and resumption of an interrupted sweep. Use when running a project's tests to find what fails, reviewing a long run without losing output to truncation, rerunning failures, or resuming a sweep, instead of running deno test directly and reading the terminal.
---

Rule: run the tool as `deno task --config <path to scratch>/deno.json test-report <command>` from the project's root
Reason: the tool reads the `tools.config.json` in the directory `deno task` was called from, resolves relative paths against it, and names the default report for it, so a call from anywhere else reads another directory's settings and state

Rule: configure the project in its `tools.config.json` under `test-report`, as `{ "test-report": { "directory": "server", "glob": "src/**/*.test.ts", "args": ["task", "test"] } }`
Reason: every key is optional, and an absent section runs `deno test` on every `**/*.test.ts` under the project root

Rule: set `directory` to the directory the tests run from, relative to the project root or absolute
Reason: the tool runs deno with that directory as its working directory, and both the glob and the file paths passed to `run` are relative to it

Rule: set `glob` to the files a full run covers, relative to `directory`
Reason: defaults to `**/*.test.ts`, and the walk skips every `node_modules` directory at any depth, so no glob reaches a dependency's tests

Rule: set `args` to the arguments deno takes before the test file, as a list of strings such as `["test", "-A"]` or `["task", "test"]`
Reason: the tool runs `deno <args...> <file>` once per file, defaults to `["test"]`, and a run without the permissions the tests need reports every file as a crash

Rule: set `report` and `state` to move the markdown report and the state file, relative to the project root or absolute
Reason: they default to `/tmp/<name>-<hash>-test-report.md` and `.json`, where `<name>` is the directory the tool was called from and `<hash>` the first eight hex digits of the SHA-256 of its absolute path, and the run commands refuse a path whose directory does not exist

Rule: expect a key the section does not define, such as a misspelled `globs`, to be refused with the key named
Reason: the tool reads only `directory`, `glob`, `args`, `report`, and `state`, so a misspelling cannot pass as an absent setting

Rule: run `test-report run [files...]` instead of running the test command directly when you want a structured report
Reason: the report keeps what a terminal loses to truncation

Rule: omit the file list to run every file `glob` matches, and pass file paths relative to `directory` to scope a run
Reason: either form resets the state to the files of this run, so the next `failed` or `continue` works from them, and a named file that does not exist is refused before the reset

Rule: rerun only the failures with `test-report failed`
Reason: it replays the files whose last result was fail or crash without rerunning passes

Rule: resume an interrupted sweep with `test-report continue`
Reason: it runs only the files of the last run that have no result yet

Rule: read the report file to review a run instead of scrolling the terminal
Reason: the report is the canonical record, while the terminal shows only progress

Rule: print the report with `test-report show` when the report path is not at hand
Reason: it renders the same markdown from the current state to stdout

Rule: list each file and its status with `test-report list`
Reason: it prints a `console.table` of `status` (pass, fail, crash, or pending) and `file` without rendering markdown

Rule: distinguish `fail` from `crash` in the report
Reason: `fail` means tests ran and some failed, while `crash` means the file exited non-zero without a failure summary, as a parse error, a panic, a port race, or a service outage does

Rule: do not parse the test command's output yourself when you want the failure list
Reason: the report already lists each failing file with its failed steps and its full output

Rule: include the raw output in any failure report you produce for the user
Reason: stack traces, log lines, and progress markers all carry diagnostic information, and condensing throws away the parts you did not know mattered

Rule: start every service the tests rely on, such as a database, before running the report
Reason: a stopped service produces a flood of `crash` results that are not real test failures

Rule: expect the progress lines and the report and state paths on stderr, and only `show` and `list` to print to stdout
Reason: a caller piping the output gets the payload alone

Rule: expect the tool to exit 0 when tests fail, and read the report for the outcome
Reason: a failing test is a result the report records, while exit 1 means the tool itself refused or could not run

Rule: pass files to `run` alone, and write each command as a word rather than a flag
Reason: the tool refuses an unknown command, an unknown flag, and a file passed to any other command, listing the valid commands

Rule: pass `--help` (`-h`) to print the usage block
Reason: lists every command and where the settings come from without leaving the terminal
