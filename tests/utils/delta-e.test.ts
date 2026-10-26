import { describe, it, expect } from 'vitest'
import { deltaE2000 } from '@/utils/delta-e'

describe('CIELAB Delta E 2000 Color Difference', () => {
  it('returns 0 for identical colors', () => {
    const lab: [number, number, number] = [50, 20, -10]
    expect(deltaE2000(lab, lab)).toBe(0)
  })

  it('calculates accurate difference between distinct colors', () => {
    const red: [number, number, number] = [53.24, 80.09, 67.20]
    const darkRed: [number, number, number] = [30.00, 50.00, 40.00]
    const diff = deltaE2000(red, darkRed)
    expect(diff).toBeGreaterThan(15)
  })

  it('measures small difference for perceptually similar colors', () => {
    const colorA: [number, number, number] = [50, 2.5, -5.0]
    const colorB: [number, number, number] = [50.5, 2.7, -4.8]
    const diff = deltaE2000(colorA, colorB)
    expect(diff).toBeLessThan(2.0) // JND (Just Noticeable Difference) ~ 1 to 2
  })
})
