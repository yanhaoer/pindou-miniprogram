import type { BeadColor, BeadPalette } from '@/palettes/types'
import { rgbToLab } from './color-space'
import { deltaE2000 } from './delta-e'

export interface BeadCell {
  x: number
  y: number
  color: BeadColor
  isEmpty: boolean
}

export interface QuantizeOptions {
  width: number
  height: number
  dither: boolean
  palette: BeadPalette
  alphaThreshold?: number
}

/**
 * Resample source RGBA buffer to target dimension and return [r, g, b, a][] array
 */
function resamplePixels(
  source: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): { r: number; g: number; b: number; a: number }[][] {
  const result: { r: number; g: number; b: number; a: number }[][] = []

  const xRatio = srcW / dstW
  const yRatio = srcH / dstH

  for (let y = 0; y < dstH; y++) {
    const row: { r: number; g: number; b: number; a: number }[] = []
    const srcY = Math.min(Math.floor(y * yRatio), srcH - 1)

    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(Math.floor(x * xRatio), srcW - 1)
      const idx = (srcY * srcW + srcX) * 4

      row.push({
        r: source[idx],
        g: source[idx + 1],
        b: source[idx + 2],
        a: source[idx + 3]
      })
    }
    result.push(row)
  }

  return result
}

/**
 * Find the closest bead color in the given palette using CIELAB Delta E 2000
 */
export function findClosestBeadColor(
  r: number,
  g: number,
  b: number,
  palette: BeadPalette
): BeadColor {
  const pixelLab = rgbToLab(r, g, b)
  let bestColor = palette.colors[0]
  let minDiff = Infinity

  for (let i = 0; i < palette.colors.length; i++) {
    const candidate = palette.colors[i]
    const diff = deltaE2000(pixelLab, candidate.lab)
    if (diff < minDiff) {
      minDiff = diff
      bestColor = candidate
      if (diff === 0) break
    }
  }

  return bestColor
}

/**
 * Quantize image data into a 2D BeadCell matrix with optional Floyd-Steinberg dithering
 */
export function quantizeImageData(
  pixels: Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
  options: QuantizeOptions
): BeadCell[][] {
  const { width, height, dither, palette, alphaThreshold = 64 } = options
  const defaultEmptyColor = palette.colors[0]

  // Step 1: Resample image to grid dimensions
  const buffer = resamplePixels(pixels, imgWidth, imgHeight, width, height)
  const grid: BeadCell[][] = []

  // Step 2: Quantize pixels with optional Floyd-Steinberg error diffusion
  for (let y = 0; y < height; y++) {
    const row: BeadCell[] = []
    for (let x = 0; x < width; x++) {
      const p = buffer[y][x]

      if (p.a < alphaThreshold) {
        row.push({
          x,
          y,
          color: defaultEmptyColor,
          isEmpty: true
        })
        continue
      }

      // Clamp RGB values
      const curR = Math.max(0, Math.min(255, p.r))
      const curG = Math.max(0, Math.min(255, p.g))
      const curB = Math.max(0, Math.min(255, p.b))

      const matched = findClosestBeadColor(curR, curG, curB, palette)

      row.push({
        x,
        y,
        color: matched,
        isEmpty: false
      })

      if (dither) {
        const errR = curR - matched.r
        const errG = curG - matched.g
        const errB = curB - matched.b

        // Diffuse errors:
        //      *    7/16
        // 3/16 5/16 1/16
        if (x + 1 < width) {
          buffer[y][x + 1].r += (errR * 7) / 16
          buffer[y][x + 1].g += (errG * 7) / 16
          buffer[y][x + 1].b += (errB * 7) / 16
        }
        if (y + 1 < height) {
          if (x > 0) {
            buffer[y + 1][x - 1].r += (errR * 3) / 16
            buffer[y + 1][x - 1].g += (errG * 3) / 16
            buffer[y + 1][x - 1].b += (errB * 3) / 16
          }
          buffer[y + 1][x].r += (errR * 5) / 16
          buffer[y + 1][x].g += (errG * 5) / 16
          buffer[y + 1][x].b += (errB * 5) / 16
          if (x + 1 < width) {
            buffer[y + 1][x + 1].r += (errR * 1) / 16
            buffer[y + 1][x + 1].g += (errG * 1) / 16
            buffer[y + 1][x + 1].b += (errB * 1) / 16
          }
        }
      }
    }
    grid.push(row)
  }

  return grid
}

export interface BeadColorStatItem {
  color: BeadColor
  count: number
}

/**
 * Calculate total usage statistics for each bead color
 */
export function getBeadColorStats(grid: BeadCell[][]): Map<string, BeadColorStatItem> {
  const stats = new Map<string, BeadColorStatItem>()

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const cell = grid[y][x]
      if (cell.isEmpty) continue

      const code = cell.color.code
      const existing = stats.get(code)
      if (existing) {
        existing.count++
      } else {
        stats.set(code, {
          color: cell.color,
          count: 1
        })
      }
    }
  }

  return stats
}
