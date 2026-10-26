import { describe, it, expect } from 'vitest'
import { rgbToXyz, xyzToLab, rgbToLab } from '@/utils/color-space'

describe('Color Space Conversions', () => {
  it('converts pure black (0, 0, 0) correctly to Lab', () => {
    const lab = rgbToLab(0, 0, 0)
    // Black in Lab is L*=0, a*=0, b*=0
    expect(lab[0]).toBeCloseTo(0, 1)
    expect(lab[1]).toBeCloseTo(0, 1)
    expect(lab[2]).toBeCloseTo(0, 1)
  })

  it('converts pure white (255, 255, 255) correctly to Lab', () => {
    const lab = rgbToLab(255, 255, 255)
    // Standard white in D65 Lab is L*=100, a*=0, b*=0
    expect(lab[0]).toBeCloseTo(100, 1)
    expect(lab[1]).toBeCloseTo(0, 1)
    expect(lab[2]).toBeCloseTo(0, 1)
  })

  it('converts pure red (255, 0, 0) to Lab with high a* value', () => {
    const lab = rgbToLab(255, 0, 0)
    expect(lab[0]).toBeGreaterThan(50) // L* ~ 53
    expect(lab[1]).toBeGreaterThan(70) // a* ~ 80 (strong red)
  })

  it('converts pure green (0, 255, 0) to Lab with negative a* value', () => {
    const lab = rgbToLab(0, 255, 0)
    expect(lab[1]).toBeLessThan(-70) // a* negative for green
  })

  it('converts pure blue (0, 0, 255) to Lab with negative b* value', () => {
    const lab = rgbToLab(0, 0, 255)
    expect(lab[2]).toBeLessThan(-70) // b* negative for blue
  })
})
