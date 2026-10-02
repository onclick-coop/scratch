# test-report

## What it does

Runs a Deno test suite one file at a time and writes a markdown report that keeps every failing file's full output.
A long run printed to a terminal loses its early failures to scrollback and truncation, so the report is where the whole run lands.

Each file runs in its own deno process, so a file that crashes takes down only its own result and the run moves on to the next.
The tool captures the process's stdout and stderr in full, strips the color escapes, and reads three things from deno test's output: each step line with its status and duration, the ERRORS block that names each failing test, and the final summary with its passed and failed counts.
Each error in the ERRORS block opens with a header line, and deno lists every one of those headers again under FAILURES.
The parser opens an error only at a line FAILURES lists and takes the lines up to the next such header as the error, so a line in an error message shaped like a header stays part of the message.
A header names the test before an arrow to its location, which `node:test`, `@std/testing`, and `Deno.test` each point somewhere different, while an uncaught error's header names the module alone.
A file that exits zero passes.
A file that exits non-zero with failed tests counted or listed fails, and one that exits non-zero with neither crashed.

The tool writes the state and the report after every file, so a killed run loses only the file in progress.
The state lists the files of the run and the result of each one that finished, which is what lets a later run take only the failures or only the files with no result.

A project sets the test directory, the glob, the arguments, and the two file paths in the `test-report` section of its `tools.config.json`, since every one of them belongs to the project's layout.
The hash of the project path in the default names keeps two projects with the same directory name from sharing a state.

The pure logic sits in modules that test without permissions: output parsing in `parse.ts`, the markdown in `markdown.ts`, the state file in `state.ts`, the config section and paths in `config.ts`, and the shapes of both files in `schema.ts`.
`main.ts` holds the CLI dispatch, the file reads and writes, the glob, and the deno runs.

## Unsupported

## Common issues

**A file that throws while loading is reported as a fail rather than a crash.**
deno counts an error thrown at import, or from a timer after its test returned, as a failed test named `<module> (uncaught error)`, so the summary carries a failed count.
Read that entry under the file's failed steps, where the error is the module's own rather than a test's assertion.
