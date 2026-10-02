# color-scale

Measures a color scale in OKLCH and extrapolates new stops past either end on the same curve.

## What it does

It reads a scale from a palette module it imports at run time, so it measures the project's own source rather than a copy.

It holds one hue for the whole scale, averaged as an angle over the stops with enough chroma to trust it, so hues either side of 0 average near 0.
A scale with no chroma at any stop gets a hue of 0, which leaves its grays gray.

A new stop continues the quadratic through the three stops at the end it lies past.
A hand-tuned scale fits no single curve across all its stops, so a local quadratic follows the end it extends, where a straight line would overshoot as the scale slows toward black.
Lightness stays between black and white and chroma stays at or above 0, however far the curve runs.

Before extrapolating, it predicts each existing stop from its three nearest other stops and prints how far each prediction misses.
An end stop is predicted exactly as a new stop past it would be, so its error shows how far the method misses at that end of this scale.

## Unsupported

**A stop inside the scale's range.**
The tool extends a scale past its ends, and a quadratic taken from an end says nothing reliable about the space between two existing stops.

## Common issues

**An export missing from the "Available scales" list.**
The list holds only the exports that pass as a scale, which takes at least four stops keyed by whole numbers with no leading zero.
Pass the export's name with `--scale` to see what it fails.

**A large `errorPct` at the end stop being extended.**
That end of the scale bends more than a quadratic through its last three stops follows.
Treat the extrapolated stop as a starting point and adjust it by eye.
