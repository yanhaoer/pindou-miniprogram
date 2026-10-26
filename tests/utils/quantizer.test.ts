import { describe, it, expect } from 'vitest'
import { quantizeImageData, getBeadColorStats } from '@/utils/quantizer'
import { getPalette } from '@/palettes'

describe('Image Quantizer & Dithering Engine', () => {
  const palette = getPalette('artkal')

  it('quantizes a simple solid red image to a bead grid', () => {
    // 2x2 solid red image RGBA (Artkal A03 rgb: 209, 26, 42)
    const pixels = new Uint8ClampedArray([
      209, 26, 42, 255,  209, 26, 42, 255,
      209, 26, 42, 255,  209, 26, 42, 255
    ])

    const grid = quantizeImageData(pixels, 2, 2, {
      width: 2,
      height: 2,
      dither: false,
      palette
    })

    expect(grid).toHaveLength(2)
    expect(grid[0]).toHaveLength(2)
    expect(grid[0][0].color.code).toBe('A03') // Red in Artkal
    expect(grid[0][0].isEmpty).toBe(false)
  })

  it('handles transparent pixels by marking them isEmpty: true', () => {
    // 1x2 image: one red pixel, one transparent pixel (alpha < 64)
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 0, 0, 0
    ])

    const grid = quantizeImageData(pixels, 2, 1, {
      width: 2,
      height: 1,
      dither: false,
      palette
    })

    expect(grid[0][0].isEmpty).toBe(false)
    expect(grid[0][1].isEmpty).toBe(true)
  })

  it('applies Floyd-Steinberg dithering without errors', () => {
    // 4x4 gradient
    const pixels = new Uint8ClampedArray(4 * 4 * 4)
    for (let i = 0; i < 16; i++) {
      pixels[i * 4] = i * 16 // R
      pixels[i * 4 + 1] = i * 16 // G
      pixels[i * 4 + 2] = i * 16 // B
      pixels[i * 4 + 3] = 255 // A
    }

    const grid = quantizeImageData(pixels, 4, 4, {
      width: 4,
      height: 4,
      dither: true,
      palette
    })

    expect(grid).toHaveLength(4)
    expect(grid[0]).toHaveLength(4)
  })

  it('computes accurate bead color usage statistics', () => {
    const pixels = new Uint8ClampedArray([
      209, 26, 42, 255,  209, 26, 42, 255,
      0, 0, 0, 255,      0, 0, 0, 0
    ])

    const grid = quantizeImageData(pixels, 2, 2, {
      width: 2,
      height: 2,
      dither: false,
      palette
    })

    const stats = getBeadColorStats(grid)
    // Red (A03) count: 2, Black (A01) count: 1, Transparent: skipped
    const redStat = stats.get('A03')
    const blackStat = stats.get('A49') || stats.get('A01')

    expect(redStat).toBeDefined()
    expect(redStat?.count).toBe(2)
    expect(blackStat).toBeDefined()
    expect(blackStat?.count).toBe(1)
  })
})
