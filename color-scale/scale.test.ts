import { assertAlmostEquals, assertEquals } from '@std/assert'
import { describe, it } from 'node:test'
import { backtest, backtestRows, extrapolate, extrapolationRows, oklchToRgb, rgbToOklch, type ScaleStop, stableHue } from './scale.ts'

const zincStops: ScaleStop[] = [
  { stop: 50, rgb: [250, 250, 250] },
  { stop: 100, rgb: [244, 244, 245] },
  { stop: 200, rgb: [228, 228, 231] },
  { stop: 300, rgb: [212, 212, 216] },
  { stop: 400, rgb: [159, 159, 169] },
  { stop: 500, rgb: [113, 113, 123] },
  { stop: 600, rgb: [82, 82, 92] },
  { stop: 700, rgb: [63, 63, 70] },
  { stop: 800, rgb: [39, 39, 42] },
  { stop: 900, rgb: [24, 24, 27] },
  { stop: 950, rgb: [9, 9, 11] },
]

const zincBacktestRows = [
  { stop: 50, source: 'rgb(250, 250, 250)', predicted: 'rgb(252, 252, 252)', errorPct: '0.784' },
  { stop: 100, source: 'rgb(244, 244, 245)', predicted: 'rgb(243, 243, 244)', errorPct: '0.392' },
  { stop: 200, source: 'rgb(228, 228, 231)', predicted: 'rgb(230, 230, 232)', errorPct: '0.784' },
  { stop: 300, source: 'rgb(212, 212, 216)', predicted: 'rgb(199, 199, 205)', errorPct: '5.098' },
  { stop: 400, source: 'rgb(159, 159, 169)', predicted: 'rgb(173, 173, 179)', errorPct: '5.490' },
  { stop: 500, source: 'rgb(113, 113, 123)', predicted: 'rgb(116, 116, 128)', errorPct: '1.961' },
  { stop: 600, source: 'rgb(82, 82, 92)', predicted: 'rgb(82, 82, 90)', errorPct: '0.784' },
  { stop: 700, source: 'rgb(63, 63, 70)', predicted: 'rgb(58, 58, 65)', errorPct: '1.961' },
  { stop: 800, source: 'rgb(39, 39, 42)', predicted: 'rgb(44, 44, 48)', errorPct: '2.353' },
  { stop: 900, source: 'rgb(24, 24, 27)', predicted: 'rgb(18, 18, 20)', errorPct: '2.745' },
  { stop: 950, source: 'rgb(9, 9, 11)', predicted: 'rgb(20, 19, 24)', errorPct: '5.098' },
]

describe('All Color Scale Tests', () => {
  describe('rgbToOklch', () => {
    it('round-trips an sRGB color through OKLCH', () => {
      // Act & Assert
      assertEquals(oklchToRgb(rgbToOklch([113, 113, 123])), [113, 113, 123])
    })
  })

  describe('oklchToRgb', () => {
    it('clamps a color past white or black to the sRGB range', () => {
      // Act & Assert
      assertEquals(oklchToRgb({ L: 1.2, C: 0, H: 0 }), [255, 255, 255])
      assertEquals(oklchToRgb({ L: -0.1, C: 0, H: 0 }), [0, 0, 0])
    })
  })

  describe('stableHue', () => {
    it('returns the zinc hue, ignoring the pure-gray lightest stop', () => {
      // Act & Assert
      assertAlmostEquals(stableHue(zincStops), 285.98, 0.01)
    })

    it('averages hues on either side of 0 to a hue near 0', () => {
      // Arrange
      const pink: ScaleStop[] = [
        { stop: 300, rgb: [255, 0, 120] },
        { stop: 500, rgb: [255, 0, 140] },
        { stop: 700, rgb: [240, 0, 110] },
        { stop: 900, rgb: [120, 0, 60] },
      ]

      // Act & Assert
      assertAlmostEquals(stableHue(pink), 2.48, 0.01)
    })

    it('returns 0 for a scale with no chroma at any stop', () => {
      // Arrange
      const gray: ScaleStop[] = [
        { stop: 50, rgb: [250, 250, 250] },
        { stop: 500, rgb: [128, 128, 128] },
        { stop: 900, rgb: [23, 23, 23] },
        { stop: 950, rgb: [10, 10, 10] },
      ]

      // Act & Assert
      assertEquals(stableHue(gray), 0)
    })
  })

  describe('backtest', () => {
    it('predicts each zinc stop from its three nearest other stops', () => {
      // Act & Assert
      assertEquals(backtestRows(backtest(zincStops)), zincBacktestRows)
    })

    it('reads the stops in order whatever order they arrive in', () => {
      // Act & Assert
      assertEquals(backtestRows(backtest([...zincStops].reverse())), zincBacktestRows)
    })

    it('shows a large error for stops that follow no curve', () => {
      // Arrange
      const zigzag: ScaleStop[] = [
        { stop: 100, rgb: [20, 20, 25] },
        { stop: 200, rgb: [240, 240, 245] },
        { stop: 300, rgb: [20, 20, 25] },
        { stop: 400, rgb: [240, 240, 245] },
      ]

      // Act
      const rows = backtestRows(backtest(zigzag))

      // Assert
      assertEquals(rows, [
        { stop: 100, source: 'rgb(20, 20, 25)', predicted: 'rgb(255, 255, 255)', errorPct: '92.157' },
        { stop: 200, source: 'rgb(240, 240, 245)', predicted: 'rgb(0, 0, 0)', errorPct: '96.078' },
        { stop: 300, source: 'rgb(20, 20, 25)', predicted: 'rgb(255, 255, 255)', errorPct: '92.157' },
        { stop: 400, source: 'rgb(240, 240, 245)', predicted: 'rgb(0, 0, 0)', errorPct: '96.078' },
      ])
    })
  })

  describe('extrapolate', () => {
    it('continues the dark end past the last stop', () => {
      // Act
      const step = extrapolate(zincStops, 975)

      // Assert
      assertEquals(step.rgb, [3, 3, 4])
      assertEquals(step.hex, '#030304')
    })

    it('continues the light end below the first stop', () => {
      // Act
      const step = extrapolate(zincStops, 25)

      // Assert
      assertEquals(step.rgb, [252, 252, 252])
      assertEquals(step.hex, '#fcfcfc')
    })

    it('reads the stops in order whatever order they arrive in', () => {
      // Act & Assert
      assertEquals(extrapolate([...zincStops].reverse(), 975).hex, '#030304')
    })

    it('holds lightness at 0 where the curve runs below black', () => {
      // Act
      const step = extrapolate(zincStops, 1200)

      // Assert
      assertEquals(step.oklch.L, 0)
      assertEquals(step.hex, '#000000')
    })

    it('holds lightness at 1 where the curve runs above white', () => {
      // Arrange
      const zigzag: ScaleStop[] = [
        { stop: 100, rgb: [20, 20, 25] },
        { stop: 200, rgb: [240, 240, 245] },
        { stop: 300, rgb: [20, 20, 25] },
        { stop: 400, rgb: [240, 240, 245] },
      ]

      // Act & Assert
      assertEquals(extrapolate(zigzag, 500).oklch.L, 1)
    })

    it('holds chroma at 0 where the curve runs below it', () => {
      // Arrange
      const fading: ScaleStop[] = [
        { stop: 600, rgb: [82, 82, 130] },
        { stop: 700, rgb: [63, 63, 110] },
        { stop: 800, rgb: [40, 40, 60] },
        { stop: 900, rgb: [24, 24, 26] },
      ]

      // Act & Assert
      assertEquals(extrapolate(fading, 1000).oklch.C, 0)
    })
  })

  describe('backtestRows', () => {
    it('writes each stop with both colors as rgb and the error to three places', () => {
      // Arrange
      const backtests = [
        { stop: 900, source: [24, 24, 27] as const, predicted: [24, 24, 27] as const, maxErrorPct: 0 },
        { stop: 950, source: [9, 9, 11] as const, predicted: [10, 9, 11] as const, maxErrorPct: 0.39215686 },
      ]

      // Act
      const rows = backtestRows(backtests)

      // Assert
      assertEquals(rows, [
        { stop: 900, source: 'rgb(24, 24, 27)', predicted: 'rgb(24, 24, 27)', errorPct: '0.000' },
        { stop: 950, source: 'rgb(9, 9, 11)', predicted: 'rgb(10, 9, 11)', errorPct: '0.392' },
      ])
    })
  })

  describe('extrapolationRows', () => {
    it('writes each step with its oklch lightness and chroma to four places beside the color', () => {
      // Arrange
      const steps = [
        { stop: 975, oklch: { L: 0.15123456, C: 0.00456789, H: 286 }, rgb: [5, 5, 6] as const, hex: '#050506' },
        { stop: 1000, oklch: { L: 0, C: 0, H: 286 }, rgb: [0, 0, 0] as const, hex: '#000000' },
      ]

      // Act
      const rows = extrapolationRows(steps)

      // Assert
      assertEquals(rows, [
        { stop: 975, L: '0.1512', C: '0.0046', rgb: 'rgb(5, 5, 6)', hex: '#050506' },
        { stop: 1000, L: '0.0000', C: '0.0000', rgb: 'rgb(0, 0, 0)', hex: '#000000' },
      ])
    })
  })
})
