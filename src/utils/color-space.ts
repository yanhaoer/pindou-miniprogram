/**
 * Color Space Conversions: sRGB <-> Linear RGB <-> CIE XYZ (D65) <-> CIE L*a*b*
 */

// D65 Standard Illuminant reference white points (2° observer)
const Xn = 0.95047
const Yn = 1.00000
const Zn = 1.08883

const DELTA = 6 / 29 // ~0.20689655
const DELTA_CUBED = DELTA * DELTA * DELTA // ~0.008856
const FACTOR = (1 / 3) * Math.pow(29 / 6, 2) // ~7.787037

/**
 * Convert standard sRGB [0..255] to CIE XYZ [0..1]
 */
export function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  // Normalize to 0..1
  let nr = r / 255
  let ng = g / 255
  let nb = b / 255

  // Inverse sRGB gamma companding
  nr = nr > 0.04045 ? Math.pow((nr + 0.055) / 1.055, 2.4) : nr / 12.92
  ng = ng > 0.04045 ? Math.pow((ng + 0.055) / 1.055, 2.4) : ng / 12.92
  nb = nb > 0.04045 ? Math.pow((nb + 0.055) / 1.055, 2.4) : nb / 12.92

  // Matrix multiplication for sRGB D65
  const x = nr * 0.4124564 + ng * 0.3575761 + nb * 0.1804375
  const y = nr * 0.2126729 + ng * 0.7151522 + nb * 0.0721750
  const z = nr * 0.0193339 + ng * 0.1191920 + nb * 0.9503041

  return [x, y, z]
}

function fLab(t: number): number {
  return t > DELTA_CUBED ? Math.cbrt(t) : FACTOR * t + 16 / 116
}

/**
 * Convert CIE XYZ to CIE L*a*b*
 */
export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const fx = fLab(x / Xn)
  const fy = fLab(y / Yn)
  const fz = fLab(z / Zn)

  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const b = 200 * (fy - fz)

  return [L, a, b]
}

/**
 * Direct conversion from sRGB [0..255] to CIE L*a*b*
 */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = rgbToXyz(r, g, b)
  return xyzToLab(x, y, z)
}

/**
 * Convert Hex string (#RRGGBB or RRGGBB) to [r, g, b]
 */
export function hexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.replace('#', '').trim()
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map(c => c + c).join('')
  }
  const num = parseInt(cleaned, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return [r, g, b]
}

/**
 * Convert [r, g, b] to hex string #RRGGBB
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/**
 * Calculate high contrast text color (black or white) for a given background hex color
 */
export function getContrastTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.5 ? '#111111' : '#FFFFFF'
}

/**
 * Determine whether color code text should be displayed based on toggle state and cell size
 */
export function shouldShowColorCode(showCodes: boolean, scaledCell: number, threshold = 7): boolean {
  return showCodes && scaledCell >= threshold
}

/**
 * Compute optimal font size for color code inside a grid cell
 */
export function computeColorCodeFontSize(scaledCell: number, min = 7, max = 15): number {
  return Math.min(Math.max(min, Math.floor(scaledCell * 0.44)), max)
}

