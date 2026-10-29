import { describe, it, expect } from 'vitest'
import { getRulerBandSize, shouldShowRulerTickNumber, computeRulerFontSize } from '@/utils/ruler'

describe('Ruler Calculation System', () => {
  it('returns 0 band size when showRulers is false', () => {
    expect(getRulerBandSize(20, false)).toBe(0)
  })

  it('calculates proper band size when showRulers is true', () => {
    expect(getRulerBandSize(10, true)).toBeGreaterThanOrEqual(16)
    expect(getRulerBandSize(40, true)).toBeLessThanOrEqual(30)
  })

  it('shows all tick numbers when scaledCell is sufficiently large (>= 12px)', () => {
    expect(shouldShowRulerTickNumber(0, 30, 15)).toBe(true)
    expect(shouldShowRulerTickNumber(1, 30, 15)).toBe(true)
    expect(shouldShowRulerTickNumber(2, 30, 15)).toBe(true)
  })

  it('steps every 5 or endpoints when scaledCell is small (< 12px)', () => {
    expect(shouldShowRulerTickNumber(0, 30, 8)).toBe(true)      // 1
    expect(shouldShowRulerTickNumber(4, 30, 8)).toBe(true)      // 5
    expect(shouldShowRulerTickNumber(29, 30, 8)).toBe(true)     // 30
    expect(shouldShowRulerTickNumber(1, 30, 8)).toBe(false)     // 2 (skipped to avoid overlapping)
  })

  it('computes readable font size', () => {
    expect(computeRulerFontSize(20)).toBeGreaterThanOrEqual(7)
    expect(computeRulerFontSize(50)).toBeLessThanOrEqual(11)
  })
})
