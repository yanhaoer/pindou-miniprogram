import { getPalette } from '@/palettes'
import type { BeadBrand, BeadColor } from '@/palettes/types'
import type { BeadCell } from '@/utils/quantizer'

export const EMPTY_BEAD_COLOR: BeadColor = {
  code: '__EMPTY__',
  hex: 'transparent',
  name: '透明',
  rgb: [0, 0, 0]
}

export function createEmptyCell(x: number, y: number): BeadCell {
  return {
    x,
    y,
    coord: { x, y },
    color: EMPTY_BEAD_COLOR,
    isEmpty: true
  } as any
}

export function normalizeGridCells(grid: (BeadCell | null)[][]): BeadCell[][] {
  if (!Array.isArray(grid)) return []
  return grid.map((row, y) => {
    if (!Array.isArray(row)) return []
    return row.map((cell, x) => {
      if (!cell || cell.isEmpty || !cell.color || cell.color.code === '__EMPTY__') {
        return createEmptyCell(x, y)
      }
      return {
        ...cell,
        x,
        y,
        coord: { x, y },
        isEmpty: false,
        color: cell.color ? { ...cell.color } : EMPTY_BEAD_COLOR
      } as BeadCell
    })
  })
}

export function serializeGridForDraft(grid: (BeadCell | null)[][]): any {
  if (!Array.isArray(grid)) return []
  return grid.map(row => {
    if (!Array.isArray(row)) return []
    return row.map(cell => {
      if (!cell || cell.isEmpty || !cell.color || cell.color.code === '__EMPTY__') {
        return null
      }
      return { code: cell.color.code, hex: cell.color.hex }
    })
  })
}

export interface DeserializeDraftOptions {
  normalizeEmpty?: boolean
}

export function deserializeGridFromDraft(
  gridData: any,
  brand: BeadBrand,
  options?: DeserializeDraftOptions
): (BeadCell | null)[][] {
  if (!Array.isArray(gridData)) return []
  const palette = getPalette(brand)
  const colorMap = new Map<string, BeadColor>()
  palette.colors.forEach(c => colorMap.set(c.code, c))

  return gridData.map((row, y) => {
    if (!Array.isArray(row)) return []
    return row.map((cell, x) => {
      if (!cell || !cell.code || cell.code === '__EMPTY__') {
        return options?.normalizeEmpty ? createEmptyCell(x, y) : null
      }
      const fullColor = colorMap.get(cell.code) || {
        code: cell.code,
        name: cell.code,
        hex: cell.hex || '#000000',
        rgb: [0, 0, 0] as [number, number, number]
      }
      return {
        x,
        y,
        coord: { x, y },
        color: fullColor,
        isEmpty: false
      } as any
    })
  })
}
