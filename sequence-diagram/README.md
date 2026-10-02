# sequence-diagram

## What it does

A diagram is data: an ordered list of participants and a list of rows, each a message between two neighbouring lifelines, a message to something off the diagram, a self stub on one lifeline, or an annotation under one.
The tool lays every diagram out by the same fixed rules, so diagrams across a set of docs line up the same way and nobody spaces lifelines by hand.

Each participant's name starts four columns left of its lifeline, and the first name sits at column 2.
A gap is as wide as its longest arrow, note, annotation, self stub, or off-diagram target, so every piece of text in it ends at least four columns before the next lifeline and never crosses a line.
A gap is also never narrower than the name on its left plus three columns, which keeps at least four spaces between that name and the next one.
A name can still run past its own lifeline when the gap its arrows set is wider than the name.

`schema.ts` holds the zod schema and the participant checks.
`render.ts` holds the layout.
`main.ts` reads the file and prints the render.

The fixtures under `fixtures/` pair a JSON diagram with its expected render, and the render test compares the two byte for byte.
A change to any layout rule shows up there as exactly the diagrams it moves, so read their diffs before accepting one.

## Unsupported

**Choosing where empty lifeline rows go.**
Two diagrams of the same exchange should space alike, so the spacing follows from the rows themselves rather than from each author's taste.

## Common issues

**"row 1: Invalid input" with no field named.**
The row matches none of the four row shapes, as a misspelled key such as `lable` or a row carrying both `to` and `target` does.
Compare the row with the shapes `--help` prints and correct the key.
