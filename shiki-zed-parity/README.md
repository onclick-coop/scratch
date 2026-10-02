# shiki-zed-parity

## What it does

Checks that a Shiki theme colors code the way Zed's One Dark does, and keeps that theme in `one-dark.theme.ts`.

Zed colors code by tree-sitter captures, such as `@variable.parameter`, and Shiki colors it by TextMate scopes, such as `variable.parameter.ts`.
The theme maps one onto the other by hand, so a gap only shows when someone compares the two.

The tool does that comparison for one fixed sample per language under `samples/`.
It parses the sample with the language's wasm grammar and runs Zed's `highlights.scm` over it, then colors each character the way Zed's editor does.
A capture takes the color of its longest dotted prefix among One Dark's syntax keys, so `@punctuation.delimiter.jsx` reads `punctuation.delimiter`.
A capture matching no key is skipped, and the capture pushed last and not yet ended wins, which lets an inner node beat its parent.
It then colors the same sample with Shiki and the theme through `codeToTokens` with `includeExplanation`, and prints every fragment whose color differs.
Each row names the theme selector that won the fragment, which is the rule a fix or a gap comment belongs beside.
The tool learns it by recoloring the sample with every selector split into its own rule under a color no other rule carries.

Zed's sources come from a checkout of `zed-industries/zed` on disk, read as plain files.
`--zed` names the checkout, and `compare` and `update` refuse to run without it.
The tool never runs git, so which Zed it compares against is whatever the checkout holds.
Most queries come from `crates/grammars/src`, HTML's come from `extensions/html/languages/html`, and the palette comes from `assets/themes/one/one.json`.

The theme defaults to `one-dark.theme.ts`, and `--theme` points at any module that exports its Shiki theme as `zedOneDark`.
The theme's comments link one.json and `crates/grammars/src` at the Zed commit it was matched against, and that commit is its pin.
Both links name the same commit, since `update` reads the pinned palette and queries from one checkout and refuses a theme whose links disagree.
A rule that sets only a style, such as italic, colors nothing, so `compare` and `redundant` leave it out of the selectors they name.

The `update` command compares two checkouts: `--pinned` at the commit the theme links, and `--zed` at a newer one.
It reads every file it needs before printing anything, then prints the pin so the `--pinned` checkout can be checked against it.
It reports the palette colors that differ from the current One Dark, the queries that changed between the checkouts, and the mismatches the current checkout adds or resolves.
A palette line it cannot read stops the run, rather than leaving that color out of the report.

The `redundant` command removes each selector in the theme alone and recolors every sample with Shiki, markdown included.
It lists each selector whose removal changed no character, with the selectors that take over what it used to win.
It sorts them into selectors matching no scope any of the theme's grammars emits, which are dead for any input, and selectors that win nothing or only same-color characters on the samples, which are candidates.

To use the theme in a project, copy `one-dark.theme.ts` over the project's theme file and keep its exports.
The copy in onclick is `services/platform/client/src/components/data/CodeBlock.theme.ts`.

## Unsupported

**No rewrite of the theme or the pins.** `update` reports and the caller edits, so each palette value, scope, and pin that moves is a change someone reviewed rather than one that arrived with a run.

**No markdown, sql, or vue in `compare`.** No wasm build of tree-sitter-markdown is published, and Zed splits markdown into a block grammar with an inline grammar injected into it, which a single parse cannot reproduce.
Zed ships no built-in query for sql or vue, so there is nothing to compare against.
The theme's Markdown mappings are therefore unverified by `compare`, while `redundant` still colors the markdown sample, since it needs Shiki alone.

## Common issues

**A mismatch hidden inside an embedded language.** Zed colors a regex inside TypeScript, or the script and style inside HTML, with a second grammar through its `injections.scm`, and those captures win.
The tool parses each sample with one grammar, so it colors that code as the host language does and reports no difference there.
The regex on line 18 of `samples/typescript.txt` is one: Zed colors its `^`, `+`, and `$` as operators and its `\d` as an escape.

**A mismatch no mapping can fix.** Shiki sometimes gives two fragments one scope where Zed gives them two captures, such as JSON `true` and `null`, both `constant.language.json`.
Any selector that fixes one breaks the other, so these stay in the list and the theme's comments name them.

**A query refused as not compiling.** The grammars come from npm packages pinned in `shiki-zed-parity/deno.json`, while Zed builds against the versions in its root `Cargo.toml`, some of them forks at a git revision.
A query naming a node the npm grammar lacks cannot compile, and the tool refuses it rather than dropping the pattern.
Raise the package with `deno add` run inside `shiki-zed-parity/` toward the version Zed pins, since `deno add` from the repo root writes to the root `deno.json`.

**A construct the two grammars parse differently.** The TypeScript and YAML grammars Zed builds are forks, so a rare construct can parse differently from the npm release and show a mismatch Zed itself would not have.
Check the capture against the query before adding a scope for it.

**A `redundant` candidate that wins no sample character.** Every selector in the theme should win at least one sample character, so that `compare` checks its color and `redundant` can tell whether it is shadowed.
A selector silent on the samples can still color code they lack, as `support.class` colors `Promise.resolve` only once a sample calls it.
Add the smallest realistic line that exercises it to the matching sample and rerun, before considering its removal.
The selector then drops off the list, or moves to shadowed with the selector that takes over named.

**Two candidates removed together.** Each candidate is tested alone, so two same-color selectors that shadow each other, such as `keyword` and `keyword.control`, can each be removable while removing both recolors code.
Remove one, rerun, and read the list again.

**Reordering rules expecting a color change.** Shiki's TextMate engine ranks the theme's rules by how specifically each selector matches, and position only breaks a tie between identical selectors.
Moving a rule up or down changes no color, so a fix is a more specific selector rather than a new position.

**A `--zed` path that is not a Zed checkout.** `compare` and `update` fail naming the file they could not read there.
Clone `zed-industries/zed` anywhere and pass that path.
A blobless clone, made with `git clone --filter=blob:none`, keeps the history a pinned checkout needs at a fraction of the size.

**An `update` that reports nothing changed when something did.** The tool cannot tell which commit a directory holds, so a `--pinned` checkout at the wrong commit compares the wrong sources without complaint.
Check it out at the commit the theme links, which the first table prints.
