# todo

## What it does

Keeps a project's todo list in one markdown file, where each `##` heading names a section and each section holds a task list.
The file stays plain markdown, so it reads anywhere markdown renders and a change to one item diffs as one line.

An item is addressed by its section and its position rather than by an id, so the file carries nothing a person would not write by hand.

Every call parses the file with the mdast GFM extensions only to learn where each section and item sits, as offsets into the text.
A change then splices just the bytes it touches, such as one checkbox character, one item's first paragraph, or one item's lines, and every other byte of the file is written back as it was read.
A byte-order mark is set aside and CRLF line endings are read as line feeds before parsing, so the offsets match the text the parser sees, and both are restored on write, the lines the tool adds included.

A write goes to a temp file beside the list and is then renamed over it, so an interrupted write leaves the old list whole rather than half written.
The temp file takes the old file's permission bits before the rename, and a list reached through a symlink is written to the file the link points at, so neither changes under the tool.
Since a rename would replace even a read-only file or a link to nothing, the tool refuses both rather than writing past them.

The pure logic sits in modules that test without permissions.
Each verb in `commands/<verb>.ts` takes the arguments and the file's text and returns the new text and what to print.
The splices are in `actions.ts`, command-line parsing and the `in <section>` split in `args.ts`, and the byte-order mark and line endings in `file.ts`.
Locating sections and items is in `parse.ts`, escaping typed text in `escape.ts`, the printed text in `print.ts`, section lookup and index checks in `section.ts`, and the config section in `config.ts`.
`io.ts` reads and writes the file, and `main.ts` holds the CLI dispatch and prints.

## Unsupported

**Printing the whole list after a change.**
A long list printed whole would bury the one section whose indices just shifted, which is the part the next call reads.

**A way to name the section besides a trailing `in`.**
A second grammar for the same choice would have to be learned beside the first, and quoting already settles every case the trailing `in` cannot.

## Common issues

**"Failed to write" on a list in a read-only directory.**
The write creates a temp file beside the list, which needs write access to the directory as well as to the file.
Give the directory write access, or point `file` at a list in a writable directory.

**"is not writable" on a list the tool should change.**
The file itself is read-only, which the tool takes as a reason to leave it alone.
Make the file writable, as with `chmod u+w TODO.md`.

**"is a symlink to ..., which does not exist".**
The list is a link whose target is missing, and writing would replace the link with a plain file.
Create the target the link names, or remove the link to start a fresh list.
