import { hexToRgb, rgbToLab } from '@/utils/color-space'
import type { BeadBrand, BeadColor, BeadPalette, RawBeadColor } from './types'
import { ARTKAL_RAW_COLORS } from './artkal'
import { PERLER_RAW_COLORS } from './perler'
import { MARD_RAW_COLORS } from './mard'

export * from './types'

function transformColors(raw: RawBeadColor[], brand: BeadBrand): BeadColor[] {
  return raw.map(item => {
    const [r, g, b] = hexToRgb(item.hex)
    const lab = rgbToLab(r, g, b)
    return {
      code: item.code,
      name: item.name,
      hex: item.hex,
      r,
      g,
      b,
      lab,
      brand
    }
  })
}

const PALETTES: Record<BeadBrand, BeadPalette> = {
  artkal: {
    id: 'artkal',
    name: 'Artkal 阿特卡',
    description: '全球广泛使用的阿特卡色系 (A系列/S系列融合豆)',
    colors: transformColors(ARTKAL_RAW_COLORS, 'artkal')
  },
  perler: {
    id: 'perler',
    name: 'Perler 经典美版',
    description: '美国历史悠久的经典拼豆色系',
    colors: transformColors(PERLER_RAW_COLORS, 'perler')
  },
  mard: {
    id: 'mard',
    name: '漫拼 Mard',
    description: '国内手作圈广泛流行且性价比较高的标准拼豆色卡',
    colors: transformColors(MARD_RAW_COLORS, 'mard')
  }
}

export function getPalette(brand: BeadBrand | string): BeadPalette {
  if (brand in PALETTES) {
    return PALETTES[brand as BeadBrand]
  }
  return PALETTES.artkal
}

export function getAllPalettes(): BeadPalette[] {
  return [PALETTES.artkal, PALETTES.perler, PALETTES.mard]
}

export function findColorByCode(brand: BeadBrand | string, code: string): BeadColor | undefined {
  const palette = getPalette(brand)
  return palette.colors.find(c => c.code.toLowerCase() === code.toLowerCase())
}
