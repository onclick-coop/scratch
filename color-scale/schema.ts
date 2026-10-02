import { z } from 'zod'
import { ANCHOR_COUNT } from './scale.ts'

const channel = z.number().int().min(0).max(255)

// A stop key as a whole number with no leading zero, so two keys can never name one stop.
export const stopPattern = /^[1-9]\d*$/

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import
export const paletteModuleInput = z.record(z.string(), z.unknown())

export type PaletteModuleInput = z.infer<typeof paletteModuleInput>

// https://github.com/tailwindlabs/tailwindcss/blob/v3.4.17/src/public/colors.js
export const scaleInput = z
  .record(z.string().regex(stopPattern), z.tuple([channel, channel, channel]))
  .refine((scale) => Object.keys(scale).length > ANCHOR_COUNT, `A scale needs at least ${ANCHOR_COUNT + 1} stops`)

export type ScaleInput = z.infer<typeof scaleInput>
