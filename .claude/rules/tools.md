Rule: put a tool in onclick-coop/tools when it works in any project given only its flags and the project's `tools.config.json`
Reason: tools is the shared repo projects will pin, so a tool here must carry nothing that belongs to one project

Rule: put a tool in onclick-coop/scratch instead when it does a real job but is tied to one setup or one narrow input format, as shiki-zed-parity is to a Zed checkout and a Shiki theme
Reason: scratch holds tools not general enough for tools, built to the same standard

Rule: take a project's paths, app names, session names, and other specifics from flags or the project's `tools.config.json`, never from a default written into the tool
Reason: a default that names one project's layout makes the tool wrong everywhere else, and a hard-coded sibling path breaks on any other machine

Rule: do not run git or any other repo-changing command inside a tool that only reads, and put such steps in its SKILL instead
Reason: the caller owns which commit and which checkout a tool reads, so a tool that checks out or fetches acts on state nobody asked it to change

Rule: give each tool a folder `<name>/` holding `main.ts` as the entry, pure logic in `<part>.ts` modules with a colocated `<part>.test.ts`, and `commands/<verb>.ts` for a tool with several verbs
Reason: one layout across tools means a reader finds the entry, the logic, and its tests in the same place every time

Rule: register each tool as a workspace member in the root `deno.json`, with its own `<name>/deno.json` for its dependencies
Reason: a tool's dependencies stay with the tool, so moving or removing it takes its imports along

Rule: add a dependency with `deno add` run inside the tool's folder, and add one used by `utils/` from the repo root
Reason: `deno add` writes to the deno.json of the directory it runs in, so running it from the root puts a tool's dependency in the shared import map

Rule: add a root task named for the tool with the narrowest permission flags it needs
Reason: `deno task <name>` is the one invocation, and the flags state the tool's reach

Rule: keep helpers shared by more than one tool in `utils/`, and take `safe` and `safeAsync` from `utils/safe.utils.ts`
Reason: one copy per repo of each helper, until onclick-coop/common exists as a submodule to replace them

Rule: do not depend on `@whaaaley/common`
Reason: the package is no longer maintained

Rule: use zod where it replaces hand-written validation of an input's shape, such as a config file or a module loaded at run time, and nowhere else
Reason: a schema states the shape once and refuses a wrong one with a readable error, while zod for a value the code already controls adds a dependency for nothing

Rule: read a project's settings from the `tools.config.json` at the root of the repo the tool runs in, in a section keyed by the tool's name
Reason: the project owns its settings, and a repo pinned as a submodule cannot hold another project's settings

Rule: treat an absent `tools.config.json` or section as the defaults, and refuse a file or section the tool cannot read as written, misspelled keys included
Reason: applying defaults to a file the author meant to configure turns a check off without a word

Rule: move a tool from onclick by copying it verbatim first, then making only the structural changes it needs to stand alone, then proving its output identical to the original before anything else changes
Reason: a straight copy keeps every difference reviewable, and parity shows the move broke nothing

Rule: review a tool after it moves or changes with three reviewers, one each for logic, interface and docs, and tests and conventions, and confirm every finding by reproducing it before acting
Reason: each angle catches what the others miss, and a reviewer is wrong often enough that an unconfirmed fix can ship a defect

Rule: follow the code conventions in onclick's `.claude/rules` (typescript.md, test.md, comments.md, formatting.md, and tools.md) for anything these rules do not cover
Reason: those are the conventions the tools were written to, until a shared instructions repo holds them for every project

Rule: install the commit-msg hook once per clone with `deno task install-hooks`, which stores the hooks directory as an absolute path
Reason: a relative hooks path resolves from wherever a worktree lives, so a worktree away from the main checkout would commit unchecked

Rule: write commit messages as one Conventional Commits subject line, with a scope from this repo's `tools.config.json`, adding a new tool's name to the scopes in the same change that adds the tool
Reason: the commit hook refuses any other scope, and the tool's name is the scope its later commits use

Rule: write non-ASCII characters in code and tests as braced escapes such as `\u{E9}`, never as the literal character or a four-digit `\uXXXX` escape
Reason: escapes keep emoji and invisible characters out of the source, and a four-digit escape is easy for an editing tool to turn into the character itself
