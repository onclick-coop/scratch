# mutate

## What it does

Breaks one behavior at a time in a project's source and checks whether its test suite fails.

A coverage report says a line ran.
It cannot say whether anything checked what the line did.
A test that fetches a path and asserts the status is 200 covers every line the request touched, including a header the upstream ignores and a claim nobody reads.
Mutating that header and watching the suite stay green is the difference.

A survivor is a mutation the suite passed on, which means the tests executed the line and did not notice it was wrong.
That is not a test failure.
It is a gap between what the tests run and what they assert, and it is invisible to a coverage percentage, since a file can report 100% with survivors in it.

The mutations come from a plan written by hand.
Each one names an anchor copied out of a source file and the text to put in its place.
The tool checks the whole plan before it touches any source, so a plan it would refuse partway through is refused before anything is mutated.
For each mutation the tool writes the changed source, runs the target's test command, reads a non-zero exit as caught, and writes the original back.
The original is also written back in a `finally`, so a run that stops on an error leaves the source as it found it.

Deno skips a `finally` when a signal ends it, so the tool handles SIGINT and SIGTERM with listeners of its own while a target's mutations run.
Writes to the source are synchronous, so none is in flight when a listener runs.

The tool is still settling.
The plan format and how a test command is run may both change, which is part of why it sits in scratch rather than in tools.

The argument checks, the plan schema, the anchor replacement, and the summary sit in `parse.ts`, tested without permissions.
`main.ts` holds the CLI dispatch, the file reads and writes, and the test command spawn.

## Unsupported

**No automatic mutation generation.**
Every mutation is written by hand into a plan.
A generator would produce hundreds of equivalent mutants and a survivor list nobody reads, and it cannot tell a behavior that matters from one that does not.
Naming the defect is the part worth doing, and Stryker covers the generated pass for a file that has never had one.

**No parallel runs.**
Each mutation writes the source, runs the suite, and restores it, so two at once on the same file would race the restore.
A plan covering thirty mutations runs the suite thirty times, which is the cost of the method.

**No exit code on survivors.**
A survivor is a finding to read rather than a gate to fail.
Wiring this into CI would turn a design question into a red build, which is the wrong shape for what it reports.

**No plans of its own.**
A plan names one project's files and carries anchors copied from that project's source, so it belongs to the project rather than to the tool.

## Common issues

**Every mutation after a certain point is reported as caught.**
A mutation made a server the suite starts hang, and the process it left behind still holds its port or socket file.
Each later run of the suite then fails on that held port or socket rather than on its own mutation, and the tool discards the suite's output, so the failure shows only as a catch.
Stop the leftover process or delete the socket file, run the test command by hand to see it pass, and rerun the plan.
