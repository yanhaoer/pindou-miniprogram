import { describe, it, expect } from 'vitest'
import {
  clampScale,
  screenToGrid,
  gridToScreen,
  calculateTouchDistance,
  calculateTouchCenter,
  clampViewportBounds,
  getCanvasRelativeCoords
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

  describe('clampViewportBounds', () => {
    it('centers board when scaled board is smaller than container', () => {
      const vp = { scale: 1.0, offsetX: 0, offsetY: 0 }
      const result = clampViewportBounds(vp, 400, 400, 200, 200)
      expect(result.offsetX).toBe(100)
      expect(result.offsetY).toBe(100)
    })

    it('clamps offsetX and offsetY within [container - board, 0] when board is larger than container', () => {
      // 画板放大后为 600x600，容器为 400x400。允许范围为 [-200, 0]
      const vp1 = { scale: 1.0, offsetX: 50, offsetY: -300 }
      const result1 = clampViewportBounds(vp1, 400, 400, 600, 600)
      expect(result1.offsetX).toBe(0) // 超过最大值 0，钳位为 0
      expect(result1.offsetY).toBe(-200) // 小于最小值 -200，钳位为 -200
    })

    it('allows valid offsets when board is inside bounds', () => {
      const vp = { scale: 1.0, offsetX: -100, offsetY: -50 }
      const result = clampViewportBounds(vp, 400, 400, 600, 600)
      expect(result.offsetX).toBe(-100)
      expect(result.offsetY).toBe(-50)
    })
  })

  describe('getCanvasRelativeCoords', () => {
    it('prefers touch.x and touch.y when they are defined numbers', () => {
      const touch = { x: 45, y: 80, clientX: 100, clientY: 220 }
      const rect = { left: 55, top: 140 }
      expect(getCanvasRelativeCoords(touch, rect)).toEqual({ x: 45, y: 80 })
    })

    it('calculates relative coords using clientX/clientY minus rect left/top when touch.x/y undefined', () => {
      const touch = { clientX: 120, clientY: 250 }
      const rect = { left: 20, top: 100 }
      expect(getCanvasRelativeCoords(touch, rect)).toEqual({ x: 100, y: 150 })
    })

    it('handles negative or boundary values properly', () => {
      const touch = { clientX: 10, clientY: 50 }
      const rect = { left: 20, top: 100 }
      expect(getCanvasRelativeCoords(touch, rect)).toEqual({ x: -10, y: -50 })
    })
  })
})
