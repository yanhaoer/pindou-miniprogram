export interface Viewport {
  scale: number
  offsetX: number
  offsetY: number
}

export interface TouchPoint {
  clientX: number
  clientY: number
}

/**
 * Clamp zoom scale between min and max
 */
export function clampScale(scale: number, min = 0.5, max = 10.0): number {
  return Math.max(min, Math.min(max, scale))
}

/**
 * Map screen pixel coordinates to bead grid coordinate (gridX, gridY)
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  viewport: Viewport,
  cellSize: number,
  gridWidth: number,
  gridHeight: number
): { gridX: number; gridY: number } | null {
  const scaledCell = cellSize * viewport.scale
  const relX = screenX - viewport.offsetX
  const relY = screenY - viewport.offsetY

  const gridX = Math.floor(relX / scaledCell)
  const gridY = Math.floor(relY / scaledCell)

  if (gridX < 0 || gridX >= gridWidth || gridY < 0 || gridY >= gridHeight) {
    return null
  }

  return { gridX, gridY }
}

/**
 * Map grid coordinate to top-left screen position
 */
export function gridToScreen(
  gridX: number,
  gridY: number,
  viewport: Viewport,
  cellSize: number
): { screenX: number; screenY: number } {
  const scaledCell = cellSize * viewport.scale
  const screenX = viewport.offsetX + gridX * scaledCell
  const screenY = viewport.offsetY + gridY * scaledCell
  return { screenX, screenY }
}

/**
 * Euclidean distance between two touch points
 */
export function calculateTouchDistance(p1: TouchPoint, p2: TouchPoint): number {
  const dx = p1.clientX - p2.clientX
  const dy = p1.clientY - p2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Midpoint center between two touch points
 */
export function calculateTouchCenter(p1: TouchPoint, p2: TouchPoint): { x: number; y: number } {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2
  }
}
