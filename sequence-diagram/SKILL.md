---
name: sequence-diagram
description: Renders a sequence diagram described as JSON into a fixed ASCII layout of named lifelines, arrows, notes, and annotations, printed for pasting into a fenced code block in a markdown doc. Use when drawing, redrawing, or editing a sequence diagram of requests or messages passing between services in a doc, instead of spacing lifelines and arrows by hand.
---

Rule: render a sequence diagram via `deno task --config <path to scratch>/deno.json sequence-diagram <file.json>` from the project's root and paste the stdout into the doc's fenced block
Reason: one renderer lays every diagram out by the same rules, so hand-spaced lifelines and arrows stop drifting between docs

Rule: pass the JSON file as a path relative to the directory the task is called from, or as an absolute path
Reason: the tool resolves a relative path from there, which `deno task` records in INIT_CWD

Rule: pass exactly one file per run, with no flag but `--help`
Reason: the tool refuses a second file and any unknown flag rather than dropping it

Rule: describe a diagram as JSON with an ordered `participants` list of display names and a `rows` list
Reason: the data is the source, so there is no syntax to learn and the schema refuses anything it does not understand, naming the row

Rule: write a message row as `{ "from", "to", "label" }` with optional `note`, `annotation`, and `style: "double"`
Reason: `from` and `to` pick the direction from participant order, `note` prints one space after the right-hand lifeline of the arrow's gap, which is the target of a rightward message and the sender of a leftward one, `annotation` prints indented under the arrow, and `double` draws the `<===` tunnel arrow

Rule: send a message only between neighbouring participants
Reason: the renderer refuses a row that would cross a lifeline, so reorder the participants or split the message into hops

Rule: write a self row as `{ "at", "text" }` for work on one lifeline, such as `parse JSON`, with an optional `annotation` under it
Reason: it draws as `|-- text` on that lifeline with no arrow, and the annotation lines up under the text

Rule: write an annotation row as `{ "at", "annotation" }` for a label under one lifeline, such as `valid?`
Reason: it draws under the lifeline at the self stub text column with no stub, and the row after it belongs to it

Rule: write a message to something outside the diagram as `{ "from", "label", "target" }` with no `to`
Reason: it draws as `|--- label --> Target` on the sending lifeline

Rule: keep every name, label, note, annotation, text, and target on one line, with no newline, tab, or other control character
Reason: the schema refuses such a character, naming the field, since it would break a rendered row apart

Rule: do not write blank rows, since the renderer decides them and refuses an empty `{}` row naming it
Reason: it draws one empty lifeline row after the header, one at the end, one before a message whose source is neither the previous arrow's source nor target, one before a message that reverses direction, one before a message that follows an arrow's or self stub's annotation, and one before a standalone annotation, which then keeps the row after it, never two in a row

Rule: give each diagram its own JSON file, so a doc with three diagrams has three files
Reason: the renderer prints one diagram per run, so a fence holding two diagrams is two files pasted with a blank line between

Rule: keep each diagram's JSON with the project's other sources rather than discarding it after pasting the render
Reason: the next edit re-renders from the JSON, where a diagram that exists only as pasted output has to be redrawn by hand

Rule: expect the diagram on stdout, ending in a newline, and every refusal on stderr as `error: <message>` with a non-zero exit
Reason: a caller can redirect the render into a file without catching an error message in it

Rule: expect the task to run with `--allow-read` and `--allow-env=INIT_CWD` alone
Reason: the tool reads one file and the calling directory, and prints, so it needs no network or write access

Rule: pass `--help` or `-h` to print the JSON shape and row kinds
Reason: the usage block documents every accepted key without leaving the terminal
