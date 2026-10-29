import type { BeadColor } from '@/palettes/types'

export const COLOR_CATEGORIES = [
  '全部',
  '图中在用',
  '红色粉色',
  '黄色橙色',
  '绿色系',
  '蓝色青色',
  '紫色系',
  '黑白灰色'
] as const

export type ColorCategory = typeof COLOR_CATEGORIES[number]

export interface ColorFilterOptions {
  search?: string
  category?: ColorCategory
  inUseColors?: BeadColor[]
}

/**
 * 将 RGB 转换为 HSL 色彩空间 (h: [0, 360], s: [0, 1], l: [0, 1])
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h *= 60
  }

  return [Math.round(h), s, l]
}

/**
 * 过滤与筛选拼豆色系库
 */
export function filterBeadColors(
  colors: BeadColor[],
  options: ColorFilterOptions = {}
): BeadColor[] {
  const { search = '', category = '全部', inUseColors = [] } = options
  let result = colors

  if (category === '图中在用') {
    result = inUseColors
  } else if (category === '红色粉色') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return (h <= 20 || h >= 330) && s > 0.15 && l > 0.15
    })
  } else if (category === '黄色橙色') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return h > 20 && h <= 65 && s > 0.15 && l > 0.15
    })
  } else if (category === '绿色系') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return h > 65 && h <= 170 && s > 0.15 && l > 0.15
    })
  } else if (category === '蓝色青色') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return h > 170 && h <= 260 && s > 0.15 && l > 0.15
    })
  } else if (category === '紫色系') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return h > 260 && h < 330 && s > 0.15 && l > 0.15
    })
  } else if (category === '黑白灰色') {
    result = colors.filter(c => {
      const [, s, l] = rgbToHsl(c.r, c.g, c.b)
      return s <= 0.15 || l <= 0.15 || l >= 0.90
    })
  }

  const query = search.trim().toLowerCase()
  if (query) {
    result = result.filter(c =>
      c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
    )
  }

  return result
}
