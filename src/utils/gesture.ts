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

/**
 * Clamp viewport offset so board cannot be dragged outside visible container.
 * If scaled board is smaller than container, board is kept centered.
 * If scaled board is larger than container, offset is clamped to [container - board, 0].
 */
export function clampViewportBounds(
  viewport: Viewport,
  containerW: number,
  containerH: number,
  boardW: number,
  boardH: number
): Viewport {
  const scaledW = boardW * viewport.scale
  const scaledH = boardH * viewport.scale

  let nextOffsetX = viewport.offsetX
  let nextOffsetY = viewport.offsetY

  // X axis constraint
  if (scaledW <= containerW) {
    nextOffsetX = Math.round((containerW - scaledW) / 2)
  } else {
    const minX = containerW - scaledW
    const maxX = 0
    nextOffsetX = Math.round(Math.max(minX, Math.min(maxX, nextOffsetX)))
  }

  // Y axis constraint
  if (scaledH <= containerH) {
    nextOffsetY = Math.round((containerH - scaledH) / 2)
  } else {
    const minY = containerH - scaledH
    const maxY = 0
    nextOffsetY = Math.round(Math.max(minY, Math.min(maxY, nextOffsetY)))
  }

  return {
    scale: viewport.scale,
    offsetX: nextOffsetX,
    offsetY: nextOffsetY
  }
}

/**
 * 获取相对于画布内部的原生像素坐标
 * 优先采用小程序 TouchEvent 自带的相对坐标 touch.x / touch.y；
 * 若未提供则使用 client 坐标减去由 SelectorQuery 测出的 canvasRect.left / canvasRect.top。
 */
export function getCanvasRelativeCoords(
  touch: { x?: number; y?: number; clientX?: number; clientY?: number },
  canvasRect: { left: number; top: number }
): { x: number; y: number } {
  if (typeof touch.x === 'number' && typeof touch.y === 'number') {
    return { x: touch.x, y: touch.y }
  }
  const clientX = typeof touch.clientX === 'number' ? touch.clientX : 0
  const clientY = typeof touch.clientY === 'number' ? touch.clientY : 0
  return {
    x: clientX - (canvasRect.left || 0),
    y: clientY - (canvasRect.top || 0)
  }
}


