import { describe, it, expect } from 'vitest'
import { HistoryManager, floodFill } from '@/utils/history'
import type { BeadCell } from '@/utils/quantizer'
import { getPalette } from '@/palettes'

describe('History Manager & Flood Fill Engine', () => {
  const palette = getPalette('artkal')
  const red = palette.colors[2]
  const blue = palette.colors[5]

  function createTestGrid(): BeadCell[][] {
    return [
      [
        { x: 0, y: 0, color: red, isEmpty: false },
        { x: 1, y: 0, color: red, isEmpty: false }
      ],
      [
        { x: 0, y: 1, color: red, isEmpty: false },
        { x: 1, y: 1, color: blue, isEmpty: false }
      ]
    ]
  }

  it('manages undo and redo states with deep cloning', () => {
    const history = new HistoryManager(10)
    const initialGrid = createTestGrid()

    history.pushState(initialGrid)
    expect(history.canUndo).toBe(false)

    // Make edit
    const modifiedGrid = createTestGrid()
    modifiedGrid[0][0].color = blue
    history.pushState(modifiedGrid)

    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)

    // Undo
    const undone = history.undo()
    expect(undone).toBeDefined()
    expect(undone![0][0].color.code).toBe(red.code)
    expect(history.canRedo).toBe(true)

    // Redo
    const redone = history.redo()
    expect(redone).toBeDefined()
    expect(redone![0][0].color.code).toBe(blue.code)
  })

  it('fills connected matching color region using flood fill BFS', () => {
    const grid = createTestGrid()
    // Flood fill starting at (0, 0) with blue color
    const affected = floodFill(grid, 0, 0, blue)

    // 3 cells were red and connected: (0,0), (1,0), (0,1)
    expect(affected).toBe(3)
    expect(grid[0][0].color.code).toBe(blue.code)
    expect(grid[1][0].color.code).toBe(blue.code)
    expect(grid[0][1].color.code).toBe(blue.code)
    expect(grid[1][1].color.code).toBe(blue.code)
  })
})
