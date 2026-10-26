import { describe, it, expect } from 'vitest'
import {
  clampScale,
  screenToGrid,
  gridToScreen,
  calculateTouchDistance,
  calculateTouchCenter
} from '@/utils/gesture'

describe('Gesture & Viewport Math System', () => {
  it('clamps scale within safe bounds (0.5x to 10.0x)', () => {
    expect(clampScale(0.2)).toBe(0.5)
    expect(clampScale(15.0)).toBe(10.0)
    expect(clampScale(2.5)).toBe(2.5)
  })

  it('accurately maps screen coordinates to grid cell coordinates', () => {
    const viewport = { scale: 1.0, offsetX: 50, offsetY: 50 }
    const cellSize = 20
    const gridW = 10
    const gridH = 10

    // Touch exactly on cell (0, 0) top-left is at (50, 50)
    const at00 = screenToGrid(60, 60, viewport, cellSize, gridW, gridH)
    expect(at00).toEqual({ gridX: 0, gridY: 0 })

    // Touch on cell (2, 3): x in [50 + 40, 50 + 60], y in [50 + 60, 50 + 80]
    const at23 = screenToGrid(100, 120, viewport, cellSize, gridW, gridH)
    expect(at23).toEqual({ gridX: 2, gridY: 3 })

    // Touch outside bounds returns null
    const outside = screenToGrid(10, 10, viewport, cellSize, gridW, gridH)
    expect(outside).toBeNull()
  })

  it('maps grid cell back to screen coordinates', () => {
    const viewport = { scale: 2.0, offsetX: 100, offsetY: 100 }
    const cellSize = 10
    // cell (1, 1) top-left at (100 + 1 * 10 * 2, 100 + 1 * 10 * 2) = (120, 120)
    const screenPos = gridToScreen(1, 1, viewport, cellSize)
    expect(screenPos).toEqual({ screenX: 120, screenY: 120 })
  })

  it('calculates touch distance and center accurately', () => {
    const t1 = { clientX: 0, clientY: 0 }
    const t2 = { clientX: 30, clientY: 40 }
    expect(calculateTouchDistance(t1, t2)).toBe(50) // 3-4-5 triangle

    const center = calculateTouchCenter(t1, t2)
    expect(center).toEqual({ x: 15, y: 20 })
  })
})
