import type { TableRow } from '../utils/table.utils.ts'

export type Rgb = readonly [number, number, number]

export type ScaleStop = {
  stop: number
  rgb: Rgb
}

export type Oklch = {
  L: number
  C: number
  H: number
}

// Every prediction runs a quadratic through this many measured stops.
export const ANCHOR_COUNT = 3

const srgbToLinear = (channel: number): number => {
  const x = channel / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

const linearToSrgb = (channel: number): number => {
  const x = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(x * 255)))
}

export const rgbToOklch = ([r, g, b]: Rgb): Oklch => {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  const okL = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const C = Math.hypot(a, bb)
  let H = Math.atan2(bb, a) * 180 / Math.PI
  if (H < 0) H += 360

  return { L: okL, C, H }
}

export const oklchToRgb = ({ L, C, H }: Oklch): Rgb => {
  const h = H * Math.PI / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)]
}

type Anchor = {
  s: number
  v: number
}

// The value at x on the polynomial through the given (stop, value) anchors.
const lagrange = (anchors: Anchor[], x: number): number => {
  let total = 0

  for (let i = 0; i < anchors.length; i++) {
    let term = anchors[i].v
    for (let j = 0; j < anchors.length; j++) {
      if (i === j) continue
      term *= (x - anchors[j].s) / (anchors[i].s - anchors[j].s)
    }
    total += term
  }

  return total
}

// Averages hue as an angle, so hues on either side of 0 meet near 0 rather than at 180.
// A stop with almost no chroma has no trustworthy hue, and a scale of only such stops gets 0.
export const stableHue = (stops: ScaleStop[]): number => {
  const chromatic = stops.map((s) => rgbToOklch(s.rgb)).filter((c) => c.C > 0.002)
  if (!chromatic.length) return 0

  const x = chromatic.reduce((acc, c) => acc + Math.cos(c.H * Math.PI / 180), 0)
  const y = chromatic.reduce((acc, c) => acc + Math.sin(c.H * Math.PI / 180), 0)
  const H = Math.atan2(y, x) * 180 / Math.PI

  return H < 0 ? H + 360 : H
}

type MeasuredStop = ScaleStop & Oklch

const measure = (stops: ScaleStop[]): MeasuredStop[] => (
  [...stops].sort((a, b) => a.stop - b.stop).map((s) => ({ ...s, ...rgbToOklch(s.rgb) }))
)

// Lightness stays within black and white, and chroma stays non-negative, however far the curve runs.
const predict = (anchors: MeasuredStop[], stop: number, hue: number): Oklch => {
  const L = Math.min(1, Math.max(0, lagrange(anchors.map((m) => ({ s: m.stop, v: m.L })), stop)))
  const C = Math.max(0, lagrange(anchors.map((m) => ({ s: m.stop, v: m.C })), stop))

  return { L, C, H: hue }
}

export type Backtest = {
  stop: number
  source: Rgb
  predicted: Rgb
  maxErrorPct: number
}

// Predicts each stop from the three nearest other stops, as a new stop past either end is predicted.
export const backtest = (stops: ScaleStop[]): Backtest[] => {
  const hue = stableHue(stops)
  const measured = measure(stops)

  return measured.map((target, index) => {
    const others = measured.filter((_, other) => other !== index)
    const start = Math.min(Math.max(0, index - 2), others.length - ANCHOR_COUNT)
    const predicted = oklchToRgb(predict(others.slice(start, start + ANCHOR_COUNT), target.stop, hue))
    const errors = target.rgb.map((channel, i) => Math.abs(channel - predicted[i]) / 255 * 100)

    return {
      stop: target.stop,
      source: target.rgb,
      predicted,
      maxErrorPct: Math.max(...errors),
    }
  })
}

export type Extrapolation = {
  stop: number
  oklch: Oklch
  rgb: Rgb
  hex: string
}

// Continues the quadratic through the three stops at whichever end the new stop lies past.
export const extrapolate = (stops: ScaleStop[], target: number): Extrapolation => {
  const measured = measure(stops)
  const isPastDarkEnd = target > measured[measured.length - 1].stop
  const anchors = isPastDarkEnd ? measured.slice(-ANCHOR_COUNT) : measured.slice(0, ANCHOR_COUNT)
  const oklch = predict(anchors, target, stableHue(stops))
  const rgb = oklchToRgb(oklch)

  return { stop: target, oklch, rgb, hex: '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('') }
}

export type BacktestRow = TableRow & {
  stop: number
  source: string
  predicted: string
  errorPct: string
}

const formatRgb = (rgb: Rgb): string => `rgb(${rgb.join(', ')})`

export const backtestRows = (rows: readonly Backtest[]): BacktestRow[] => (
  rows.map((row) => ({
    stop: row.stop,
    source: formatRgb(row.source),
    predicted: formatRgb(row.predicted),
    errorPct: row.maxErrorPct.toFixed(3),
  }))
)

export type ExtrapolationRow = TableRow & {
  stop: number
  L: string
  C: string
  rgb: string
  hex: string
}

export const extrapolationRows = (steps: readonly Extrapolation[]): ExtrapolationRow[] => (
  steps.map((step) => ({
    stop: step.stop,
    L: step.oklch.L.toFixed(4),
    C: step.oklch.C.toFixed(4),
    rgb: formatRgb(step.rgb),
    hex: step.hex,
  }))
)
