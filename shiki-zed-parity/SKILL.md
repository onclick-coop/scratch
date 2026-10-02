---
name: shiki-zed-parity
description: Compares a Shiki code theme against Zed's One Dark character by character, reports what changed in Zed since the theme's pinned commit, and lists theme selectors that may be redundant. Use when editing, updating, or checking the One Dark code block theme, or after Zed changes its One Dark palette or highlight queries.
---

Rule: compare the theme against Zed's One Dark via `deno task shiki-zed-parity --zed <path>` from the scratch repo root instead of reading highlights.scm files and Shiki scope stacks by hand
Reason: the tool diffs every character the same way on every run

Rule: make theme changes in `shiki-zed-parity/one-dark.theme.ts`, then copy the file over the project's theme, such as onclick's `services/platform/client/src/components/data/CodeBlock.theme.ts`
Reason: the tool maintains this copy, so a fix made in a project's copy is lost on the next copy across

Rule: keep the theme's exports when copying it into a project, since the tool reads `zedOneDark` and a code block imports both `CODE_THEME` and `zedOneDark`
Reason: the file is used verbatim on both sides, so renaming an export breaks whichever side still uses the old name

Rule: pass `--theme <path>` to check another module that exports its Shiki theme as `zedOneDark`, such as a project's copy before replacing it
Reason: the tool loads the module at run time and refuses one without that export, naming what it found

Rule: pass `--zed <path>` naming a zed-industries/zed checkout to `compare` and `update`, which refuse to run without it
Reason: the tool reads the checkout as plain files and runs no git, so whatever the directory holds is the Zed it compares against

Rule: clone Zed once with `git clone --filter=blob:none https://github.com/zed-industries/zed.git <path>` when no checkout exists
Reason: a blobless clone keeps the full history the pinned checkout needs while fetching file contents only as they are read

Rule: run `git -C <clone> pull` before comparing against the latest Zed, and `git -C <clone> checkout <sha>` to compare against another commit
Reason: choosing the Zed version is a git step the caller owns

Rule: expect `compare` to be the command that runs when none is given, covering every compared language
Reason: a full sweep is the common check after a theme edit, so `deno task shiki-zed-parity --zed <path>` needs no command word

Rule: pass one language after `compare`, as `deno task shiki-zed-parity compare tsx --zed <path>`, to scope a run
Reason: the tool refuses a language name given as the command, since the command is always the first word

Rule: name bash, css, html, json, tsx, typescript, or yaml as the language, and expect markdown, sql, and vue to be refused with the reason
Reason: those seven are the languages the tool can compare, and the README's Unsupported section says why the others are not

Rule: read each row as the fragment, our color, the theme selector that won it, Zed's color, the Zed capture that set it, and the innermost three Shiki scopes
Reason: the capture says which theme key Zed used and the scopes say which selector would reach the fragment, which together name the mapping to add

Rule: place a gap comment beside the rule holding the selector the row names, not beside the rule a guess at the scope suggests
Reason: the selector column names the rule that actually colored the fragment

Rule: pass `--json` to print one mismatch per line with the whole scope stack
Reason: the table trims the stack to fit, while a selector with a parent scope needs the scopes above it

Rule: expect the mismatch rows on stdout and the per-language count on stderr
Reason: a caller piping the output gets the payload alone

Rule: check a remaining mismatch against the gaps the theme's comments name before adding a scope for it
Reason: some mismatches cannot be fixed by any mapping, and the theme's comments record each one found

Rule: treat code inside an embedded language, such as a regex in TypeScript or a script in HTML, as unchecked by `compare`
Reason: the tool cannot see a mismatch there, so an empty report says nothing about that code

Rule: read the theme's one.json permalink and `crates/grammars/src` link as its pin, the Zed commit it was last matched against, and keep both links at that one commit
Reason: `update` reads the pinned palette and queries from one checkout, so it refuses a theme whose links name two commits

Rule: read the `crates/grammars/src` link as pinning HTML's queries under `extensions/html/languages/html` too
Reason: one pin covers both query paths, since they live in the same repo at the same commit

Rule: make the pinned checkout with `git -C <clone> worktree add --detach <dir> <sha>`, taking the SHA from the theme's links, and remove it with `git -C <clone> worktree remove <dir>` afterwards
Reason: a worktree shares the clone's history, so the pinned and current Zed sit side by side without a second clone

Rule: run `deno task shiki-zed-parity update --zed <clone> --pinned <dir>` to learn what changed in Zed since the pin
Reason: it reports the palette, query, and mismatch changes between the two checkouts in one run

Rule: confirm the pinned checkout holds the commit the first table prints, as with `git -C <dir> rev-parse HEAD`, before trusting an empty report
Reason: the tool cannot tell which commit a directory holds, so a checkout at the wrong commit compares the wrong sources without complaint

Rule: expect `update` to edit nothing
Reason: it is a report the caller acts on, so every change to the theme or its pin stays a reviewable edit

Rule: update end to end by pulling the clone, adding the pinned worktree, running `update`, changing each palette value it lists in the theme, rerunning `compare` and fixing each mapping it shows until only the gaps the theme's comments name remain, moving both theme links to the clone's commit, and removing the worktree
Reason: the theme's links, palette, and scopes must all describe the same commit for the next `update` to start clean

Rule: run `deno task shiki-zed-parity redundant` to list theme selectors whose removal alone changes no character in any sample
Reason: it finds selectors to consider removing, with the selectors that would take over

Rule: expect `redundant` to run without `--zed`
Reason: it colors the samples with Shiki alone, so it never reads Zed

Rule: read a `redundant` row marked `emitted by no grammar` as dead for any input, and every other row as a candidate rather than a verdict
Reason: the first matches no scope the theme's grammars can emit, while the rest are silent only on the samples, which cannot hold every construct

Rule: keep every theme selector winning at least one sample character
Reason: a selector the samples never reach goes unchecked by `compare` and reads as a `redundant` candidate for want of input rather than for being shadowed

Rule: add the smallest realistic line that exercises a `redundant` candidate marked `wins no sample character` to the matching sample and rerun, before considering its removal
Reason: the rerun either drops the candidate or names the selector shadowing it

Rule: remove candidates one at a time and rerun between removals
Reason: each is tested alone, so two same-color selectors that shadow each other, such as `keyword` and `keyword.control`, each pass while removing both recolors code

Rule: add a construct to the language's file under `samples/` when a mapping needs coverage, rather than a second sample
Reason: the samples are the fixed input that makes two runs comparable, so one file per language keeps every finding traceable to a line

Rule: raise a grammar package by running `deno add` inside `shiki-zed-parity/` when a query is refused as not compiling, toward the version in the root Cargo.toml of the Zed checkout
Reason: `deno add` from the repo root writes to the root deno.json instead of the tool's

Rule: expect the task to run with `--allow-read` and `--allow-env=VSCODE_TEXTMATE_DEBUG` alone
Reason: the tool reads the theme, the samples, the wasm grammars, and the Zed checkouts, and Shiki's TextMate engine reads that one variable when it loads
