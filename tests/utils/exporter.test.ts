import { describe, it, expect } from 'vitest'
import { calculateSheetDimensions, formatSheetTitle } from '@/utils/exporter'

describe('Bead Craft Sheet Exporter System', () => {
  it('calculates proper high-res export sheet dimensions', () => {
    // 50x50 board with 18 distinct colors
    const dims = calculateSheetDimensions(50, 50, 18, {
      cellSize: 24,
      rulerSize: 36,
      headerHeight: 90,
      margin: 30
    })

    // Board area = 50 * 24 = 1200px
    // Total width = boardArea + rulerSize + 2 * margin = 1200 + 36 + 60 = 1296px
    expect(dims.width).toBe(1296)
    // Height includes header + board + ruler + legend table
    expect(dims.height).toBeGreaterThan(1400)
    expect(dims.boardWidth).toBe(1200)
    expect(dims.boardHeight).toBe(1200)
  })

  it('formats clean craft sheet header info string', () => {
    const title = formatSheetTitle('Artkal 阿特卡', 50, 50, 2500, 15)
    expect(title).toContain('50×50')
    expect(title).toContain('Artkal')
    expect(title).toContain('2500')
    expect(title).toContain('15')
  })
})
