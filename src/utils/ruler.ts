/**
 * Calculate the width/height of the ruler band around the grid
 */
export function getRulerBandSize(scaledCell: number, showRulers: boolean): number {
  if (!showRulers) return 0
  return Math.round(Math.max(16, Math.min(26, scaledCell * 0.85)))
}

/**
 * Determine whether to show the text number for column/row index (0-based index)
 */
export function shouldShowRulerTickNumber(index: number, total: number, scaledCell: number): boolean {
  if (scaledCell >= 12) {
    return true
  }
  const naturalNumber = index + 1
  return naturalNumber === 1 || naturalNumber === total || naturalNumber % 5 === 0
}

/**
 * Compute the font size for ruler tick numbers
 */
export function computeRulerFontSize(scaledCell: number): number {
  return Math.min(10, Math.max(7, Math.floor(scaledCell * 0.45)))
}
