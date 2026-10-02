---
name: mutate
description: Proves a test suite actually checks what it covers by applying hand-written mutations from a json plan one at a time, running the suite after each, and naming every mutation the suite passed on. Use when asked whether tests really assert a behavior, to find coverage that checks nothing, to mutation-test a file, or to confirm a new test would catch a regression, instead of trusting a coverage percentage.
---

Rule: prove test coverage is real by running `deno task --config <path to scratch>/deno.json mutate --plan <path>` from the root of the checkout to mutate, rather than trusting a coverage percentage
Reason: coverage counts lines the tests executed, where this counts behaviors the tests would notice breaking

Rule: run the tool in a git worktree of the project, never in the working copy
Reason: the tool writes each mutation into the real source file, and a SIGKILL or a crashed host leaves it there, which a worktree keeps away from the copy being edited

Rule: create the worktree with `git worktree add ../<project>-mutate` from the project's root, call the tool from inside it, and remove it with `git worktree remove ../<project>-mutate` when the run is done
Reason: a named worktree is removable in one command, where a stale one is another checkout to reason about

Rule: do not run the tool against a tree carrying uncommitted edits to a source it mutates
Reason: the restore writes back what the file held at the start, so an edit made mid-run is overwritten

Rule: expect Ctrl+C or SIGTERM to stop the test command in flight, restore the source, and exit with 130 or 143
Reason: an interrupted run needs no cleanup, so stopping a slow plan partway is safe

Rule: write the plan as a json array of targets, each naming `dir`, `cmd`, `source`, and `mutations`, with each mutation naming a non-empty `name` and `before` and an `after`
Reason: the tool reads these keys alone and refuses an empty `name` or `before`, since an empty anchor matches the start of every file

Rule: give `dir` relative to the directory the tool is called from and `source` relative to `dir`, or either one as an absolute path
Reason: a relative plan then mutates whichever checkout it is called from, including a worktree

Rule: pass `--plan` relative to the directory the tool is called from, or as an absolute path
Reason: the plan is only read, so a plan the worktree does not carry can be named by its absolute path in the main checkout while `dir` still resolves inside the worktree

Rule: keep plans out of the project's history, such as in a gitignored directory, and name each for the part of the project it covers
Reason: a plan is worth rerunning, but its anchors are exact source strings that rot on the first reformat, so history is the wrong home for them

Rule: name the test command in `cmd` exactly as the suite runs it, including its permission flags, and run it by hand in `dir` once before the plan
Reason: a command that cannot run fails for its own reason and reports every mutation as caught

Rule: start `cmd` with `deno`
Reason: the task lets the tool run `deno` alone, so it refuses a plan whose `cmd` starts with anything else, an empty `cmd` or a leading space included

Rule: write `cmd` as words separated by single spaces, with no quotes, pipes, globs, or variable assignments
Reason: the tool splits the command on spaces and runs it without a shell, so shell syntax reaches the program as literal arguments

Rule: copy each `before` anchor out of the source file verbatim, whitespace included
Reason: the tool refuses an anchor the file does not carry rather than leaving the source unchanged and reading it as caught

Rule: rewrite an anchor the tool refuses rather than deleting the mutation
Reason: a refused anchor means the source moved, not that the behavior stopped mattering

Rule: give two mutations of one behavior distinct anchor text, never the same `before` string twice
Reason: the tool replaces the first occurrence without checking, so both entries hit one line and one of them mutates something it never named

Rule: write each mutation to break one behavior, such as inverting a guard, dropping a header, or returning a wrong status
Reason: a mutation that changes two things cannot say which of them the tests check

Rule: name each mutation for the defect it introduces, as `token never checked` or `retry-after header dropped`
Reason: the name is what the survivor list prints, so it has to say what went unchecked without opening the plan

Rule: write an `after` that keeps every import and binding used, reaching for a no-op reference where dropping a call would orphan one
Reason: the mutation has to leave code the compiler accepts, or it proves the compiler works rather than that the tests do

Rule: confirm a mutation is caught by a failing test rather than by the type checker when `cmd` runs `deno test`, which type-checks before it tests
Reason: a mutation that orphans an import or a binding fails the type check and scores as caught while no test ever observed the behavior

Rule: reach for a mutation whose input the tests already exercise, rather than one no test reaches
Reason: an unreached mutation survives for want of a test rather than for want of an assertion, which coverage already reports

Rule: fix a survivor by asserting the behavior, never by deleting the mutation
Reason: the mutation is the finding, so removing it hides the gap it found

Rule: add a mutation for a behavior whose test was lost, naming it as a known survivor rather than leaving the gap silent
Reason: a named survivor is a gap someone can read in the run, where an unpinned one is indistinguishable from covered code

Rule: pass `--source <path>` (`-s`) to run only the target whose `source` matches, written exactly as the plan writes it
Reason: a full plan runs the suite once per mutation, so narrowing is what makes the loop fast, and a value no target carries is refused with the plan's sources listed

Rule: name the plan with `--plan <path>` (`-p`), never as a bare word
Reason: the tool refuses a positional argument, an empty `--plan`, and any flag it does not know rather than absorbing them

Rule: expect each target's progress to print on stderr and the summary on stdout
Reason: a caller piping the output gets the summary alone, where the per-mutation lines stay on the terminal

Rule: pass `--help` or `-h` to print the plan shape and the options
Reason: the usage block documents the target fields without leaving the terminal
