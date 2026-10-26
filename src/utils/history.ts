import type { BeadCell } from './quantizer'
import type { BeadColor } from '@/palettes/types'

export function cloneGrid(grid: BeadCell[][]): BeadCell[][] {
  return grid.map(row => row.map(cell => ({ ...cell, color: { ...cell.color } })))
}

export class HistoryManager {
  private undoStack: BeadCell[][][] = []
  private redoStack: BeadCell[][][] = []
  private maxHistory: number

  constructor(maxHistory = 20) {
    this.maxHistory = maxHistory
  }

  public pushState(grid: BeadCell[][]): void {
    this.undoStack.push(cloneGrid(grid))
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift()
    }
    this.redoStack = []
  }

  public undo(): BeadCell[][] | null {
    if (this.undoStack.length <= 1) return null
    const current = this.undoStack.pop()!
    this.redoStack.push(current)
    const previous = this.undoStack[this.undoStack.length - 1]
    return cloneGrid(previous)
  }

  public redo(): BeadCell[][] | null {
    if (this.redoStack.length === 0) return null
    const next = this.redoStack.pop()!
    this.undoStack.push(next)
    return cloneGrid(next)
  }

  public get canUndo(): boolean {
    return this.undoStack.length > 1
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  public clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}

/**
 * Flood Fill (Bucket tool) using BFS
 */
export function floodFill(
  grid: BeadCell[][],
  startX: number,
  startY: number,
  newColor: BeadColor
): number {
  const height = grid.length
  if (height === 0) return 0
  const width = grid[0].length

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return 0
  }

  const startCell = grid[startY][startX]
  const targetCode = startCell.isEmpty ? '__EMPTY__' : startCell.color.code
  if (!startCell.isEmpty && targetCode === newColor.code) {
    return 0 // Same color, no op
  }

  const queue: [number, number][] = [[startX, startY]]
  const visited = new Uint8Array(width * height)
  visited[startY * width + startX] = 1

  let affectedCount = 0

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!
    const cell = grid[cy][cx]
    const currentCode = cell.isEmpty ? '__EMPTY__' : cell.color.code

    if (currentCode === targetCode) {
      cell.color = { ...newColor }
      cell.isEmpty = false
      affectedCount++

      // 4-way neighbors
      const neighbors: [number, number][] = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1]
      ]

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = ny * width + nx
          if (!visited[idx]) {
            visited[idx] = 1
            queue.push([nx, ny])
          }
        }
      }
    }
  }

  return affectedCount
}
