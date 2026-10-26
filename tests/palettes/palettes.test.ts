import { describe, it, expect } from 'vitest'
import { getPalette, getAllPalettes, findColorByCode } from '@/palettes'

describe('Bead Palettes Database', () => {
  it('loads all 3 major brands (Artkal, Perler, Mard)', () => {
    const palettes = getAllPalettes()
    expect(palettes.length).toBe(3)
    const ids = palettes.map(p => p.id)
    expect(ids).toContain('artkal')
    expect(ids).toContain('perler')
    expect(ids).toContain('mard')
  })

  it('verifies Artkal palette data validity and Lab cache', () => {
    const artkal = getPalette('artkal')
    expect(artkal).toBeDefined()
    expect(artkal.colors.length).toBeGreaterThan(50)

    // Check Artkal black (A01)
    const a01 = artkal.colors.find(c => c.code === 'A01')
    expect(a01).toBeDefined()
    expect(a01?.hex.toLowerCase()).toBe('#1a1a1a')
    expect(a01?.lab).toHaveLength(3)
    expect(a01?.name).toContain('黑')
  })

  it('verifies Perler palette data validity', () => {
    const perler = getPalette('perler')
    expect(perler).toBeDefined()
    expect(perler.colors.length).toBeGreaterThan(30)
    const pBlack = perler.colors.find(c => c.code === 'P01' || c.code === 'P18' || c.name.includes('黑'))
    expect(pBlack).toBeDefined()
    expect(pBlack?.lab).toBeDefined()
  })

  it('verifies Mard palette data validity', () => {
    const mard = getPalette('mard')
    expect(mard).toBeDefined()
    expect(mard.colors.length).toBeGreaterThan(40)
  })

  it('finds color by code in selected palette', () => {
    const color = findColorByCode('artkal', 'A01')
    expect(color).toBeDefined()
    expect(color?.brand).toBe('artkal')
  })
})
