import { describe, it, expect } from 'vitest'
import { filterBeadColors, COLOR_CATEGORIES } from '@/utils/color-filter'
import type { BeadColor } from '@/palettes/types'

const mockColors: BeadColor[] = [
  { code: 'A01', name: '大红色', hex: '#E60012', r: 230, g: 0, b: 18, lab: [48, 75, 54], brand: 'artkal' },
  { code: 'A02', name: '柠檬黄', hex: '#FFF100', r: 255, g: 241, b: 0, lab: [93, -12, 88], brand: 'artkal' },
  { code: 'A03', name: '天蓝色', hex: '#00A0E9', r: 0, g: 160, b: 233, lab: [62, -10, -50], brand: 'artkal' },
  { code: 'A04', name: '草绿色', hex: '#009944', r: 0, g: 153, b: 68, lab: [55, -55, 35], brand: 'artkal' },
  { code: 'A05', name: '纯黑色', hex: '#000000', r: 0, g: 0, b: 0, lab: [0, 0, 0], brand: 'artkal' },
  { code: 'A06', name: '纯白色', hex: '#FFFFFF', r: 255, g: 255, b: 255, lab: [100, 0, 0], brand: 'artkal' }
]

describe('Color Filter System', () => {
  it('exposes defined color categories', () => {
    expect(COLOR_CATEGORIES).toContain('全部')
    expect(COLOR_CATEGORIES).toContain('图中在用')
    expect(COLOR_CATEGORIES).toContain('红色粉色')
  })

  it('filters by search keyword in code or name', () => {
    const res = filterBeadColors(mockColors, { search: '大红' })
    expect(res.length).toBe(1)
    expect(res[0].code).toBe('A01')

    const res2 = filterBeadColors(mockColors, { search: 'A03' })
    expect(res2.length).toBe(1)
    expect(res2[0].code).toBe('A03')

    const res3 = filterBeadColors(mockColors, { search: 'a0' })
    expect(res3.length).toBe(6)
  })

  it('filters by "图中在用" category', () => {
    const inUse = [mockColors[0], mockColors[2]]
    const res = filterBeadColors(mockColors, { category: '图中在用', inUseColors: inUse })
    expect(res.length).toBe(2)
    expect(res[0].code).toBe('A01')
    expect(res[1].code).toBe('A03')
  })

  it('filters by hue category like 红色粉色 and 绿色系', () => {
    const redRes = filterBeadColors(mockColors, { category: '红色粉色' })
    expect(redRes.some(c => c.code === 'A01')).toBe(true)

    const greenRes = filterBeadColors(mockColors, { category: '绿色系' })
    expect(greenRes.some(c => c.code === 'A04')).toBe(true)

    const bwRes = filterBeadColors(mockColors, { category: '黑白灰色' })
    expect(bwRes.some(c => c.code === 'A05')).toBe(true)
    expect(bwRes.some(c => c.code === 'A06')).toBe(true)
  })
})
