---
name: todo
description: Keeps a project's long-lived todo list in a markdown file of named sections, listing it and adding, checking, unchecking, editing, and removing items by index. Use when a future task surfaces that should outlive the session, when work on a listed todo passes verification, or when asked what is left to do, instead of a task list that disappears with the session.
---

Rule: run the tool as `deno task --config <path to scratch>/deno.json todo <command>` from the project's root
Reason: the tool reads and writes the list in the directory `deno task` was called from, so a call from a subdirectory keeps a separate list there

Rule: persist long-lived todos with this tool rather than a session-only task list
Reason: session todos disappear with the session, and the file survives across sessions and processes

Rule: expect the list to live in `TODO.md` at the project's root, and set `file` in the `todo` section of the project's `tools.config.json` to keep it elsewhere, as `{ "todo": { "file": "notes/TODO.md" } }`
Reason: a relative `file` resolves against the project's root, and the tool refuses a misspelled key or an empty value rather than falling back to `TODO.md`

Rule: list everything with `todo` and no further arguments
Reason: the default command is `list`, which prints the whole file

Rule: list one section with `todo list in <section>`
Reason: a scoped read keeps a long list short

Rule: add an item with `todo add '<text>' in <section>`
Reason: the item goes to the end of the section, and a section that does not exist yet is created after the others

Rule: mark items done with `todo check <indices> in <section>`
Reason: indices are zero-based and comma-separated, as `0,2,5`

Rule: mark items not done with `todo uncheck <indices> in <section>`
Reason: it takes the same index list as `check`

Rule: delete items with `todo remove <indices> in <section>`
Reason: it takes the same index list as `check`

Rule: rewrite an item with `todo edit <index> '<text>' in <section>`
Reason: it takes exactly one index and keeps the item's checkbox as it was

Rule: write an index list as one word with no spaces, or quote it whole as `'0, 2'`
Reason: the shell splits `0, 2` into two words, and the tool refuses the second word rather than guessing at it

Rule: omit `in <section>` only when the file holds exactly one section
Reason: the single section resolves on its own, while with several the tool refuses the call and lists them, and on an empty list it asks for a section to create

Rule: quote item text as one argument whenever it contains the word `in`, as `todo add 'log in once' in auth`
Reason: the tool reads the words after the last argument that is exactly `in` as the section, so unquoted, `todo add log in once` adds `log` to a new section named `once`

Rule: expect `add` to refuse unquoted words after an `in` when they are several and name no section, and quote either the item or the section name as the error suggests
Reason: `todo add log in to box` would otherwise create a section named `to box`, and only a single word or one quoted argument creates a section

Rule: quote a section name that contains the word `in` as one argument, as `todo list in 'sign in flow'`
Reason: unquoted, the split at the last `in` reads only `flow` as the section

Rule: reach a section named `in` with a second `in`, as `todo list in in`
Reason: the split uses the last `in` that has a word after it, so a lone trailing `in` stays part of the item text

Rule: give each section its own heading text
Reason: the tool refuses a name two headings share and names their lines, rather than acting on the first

Rule: pass no words to `list` before `in`
Reason: the tool refuses them and suggests `list in <section>`, rather than ignoring them and printing everything

Rule: put `--` before the command when the item text starts with a dash, as `todo -- add '-x flag' in cli`
Reason: the tool refuses an unknown flag rather than absorbing it, and everything after `--` is read as a word

Rule: expect text passed to `add` and `edit` to be stored literally, with markdown characters such as `*` and `` ` `` escaped
Reason: typed text reads back as typed, so emphasis, a link, or code in an item has to be written into the file by hand

Rule: edit the file by hand whenever the tool cannot express a change, such as nesting a list under an item or adding notes between lists
Reason: a change through the tool rewrites only the bytes it touches, so hand-written markup, nested content, and text outside any list stay as written

Rule: name a section by its heading's text with the markup left out, so `## *urgent* fixes` is `in 'urgent fixes'`
Reason: the tool reads a heading's text through its markup, and a section the tool creates gets its name escaped the same way items are

Rule: count indices over every bullet in a section's lists, including one that opens with no text, such as an empty bullet or a code fence
Reason: the index then matches the bullet a reader counts to, and `check`, `uncheck`, and `edit` refuse a bullet with no text, naming it, while `remove` deletes it

Rule: expect a list inside a quote or before the first heading to hold no items
Reason: only the lists directly inside a section count, and the others stay in the file untouched

Rule: read indices from the section a mutation prints before passing more of them
Reason: every mutation prints the section it changed, and indices shift after an `add` or `remove`

Rule: expect a section to leave the file once its last item is removed and nothing but its heading is left
Reason: the write drops an empty heading but keeps one with notes under it, while the printed output shows the heading either way

Rule: expect `check` on a plain list item with no checkbox to add `[x]`, and `uncheck` to leave it as it is
Reason: a plain item reads as not done, so only checking it needs a box

Rule: expect the list or the changed section on stdout as markdown, `(no items)` for an empty list, and errors on stderr with exit code 1
Reason: a caller piping the output gets the list alone

Rule: expect an index past the end of the section to be refused before anything is written
Reason: the tool names the section's index range, so the file never holds half a change

Rule: scope sections by topic, not by date or status
Reason: sections are durable, status belongs in the checkbox, and dates belong in commit history

Rule: add a todo whenever a future task surfaces, without waiting for the user to ask for one
Reason: capturing the work the moment it comes up keeps incidental ideas raised mid-task from being lost

Rule: check off a todo the moment its work passes verification
Reason: a list that lags the work makes the user ask for updates the file should already show

Rule: do not check off a todo until tests pass or the user has confirmed the change
Reason: `[x]` should mean done, not in flight

Rule: remove a checked-off todo once no follow-up is pending
Reason: the file is a queue, not a history, and commit history is the durable record

Rule: pass `--help` or `-h` to print the usage block
Reason: it lists every command without leaving the terminal
