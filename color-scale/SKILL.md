---
name: color-scale
description: Measures a Tailwind-style color scale in OKLCH, checks how well a curve predicts its existing stops, and extrapolates new stops past either end, such as a 975 or 1000 shade past 950. Use when adding or checking a shade at the end of a palette's color scale instead of picking hex values by eye.
---

Rule: extend a color scale via `deno task color-scale --palette <path> --scale <name>` from the scratch repo root instead of picking hex values by eye
Reason: the tool shows how well its curve predicts the stops it already has before it extends the scale

Rule: pass `--palette` the absolute path of a module that exports each scale as `{ [stop]: [r, g, b] }`
Reason: the tool resolves a relative path from the scratch repo root rather than the shell's directory

Rule: give each scale at least four stops, keyed by whole numbers with no leading zero, each color three whole channels from 0 to 255
Reason: the tool refuses any other export as a scale and names what failed

Rule: pass `--scale <name>` to choose the exported scale, leaving it off to list the exports that are scales
Reason: a missing or unknown name is refused with that list

Rule: pass `--stops <list>` as comma-separated whole numbers past either end of the scale, which defaults to `975,1000`
Reason: the tool refuses a stop inside the scale, a stop named twice, and anything but plain digits up to 1000000

Rule: read the `errorPct` of the end stop being extended before trusting an extrapolation past it
Reason: that stop is predicted the same way a new stop past it is, so its error is how far the extrapolation may miss

Rule: read the output as two `console.table` tables, the backtest as `stop`, `source`, `predicted`, `errorPct` and the extrapolation as `stop`, `L`, `C`, `rgb`, `hex`
Reason: `hex` is the value to copy into a palette

Rule: do not commit a new scale value from this tool to a project without applying it to every place that project keeps the scale
Reason: a project can hold one scale in several files, such as a palette module, a Tailwind config, and a stylesheet, and changing one drifts the others

Rule: expect the task to run with `--allow-read` alone
Reason: the tool imports the palette module and prints, so it needs no network, env, or write access
