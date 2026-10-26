export interface SamplePattern {
  id: string
  name: string
  width: number
  height: number
  description: string
  pixels: string[] // Row by row characters or hex codes
}

export const SAMPLES: SamplePattern[] = [
  {
    id: 'mushroom',
    name: '超级蘑菇 Super Mushroom',
    width: 16,
    height: 16,
    description: '经典马里奥能量蘑菇 16×16',
    pixels: [
      "....RRRRRR......",
      "..RRRRRRRRRR....",
      ".RRRRRRRRRRRR...",
      ".RRWWRRRRWWRR...",
      "RWWWWWRRWWWWWR..",
      "RWWWWWRRWWWWWR..",
      "RRWWRRRRRRWWRR..",
      "RRRRRRRRRRRRRR..",
      "..FFFFFFFFFF....",
      ".FFFFFFFFFFFF...",
      ".FFBFFFFFBFFF...",
      ".FFBFFFFFBFFF...",
      ".FFFFFFFFFFFF...",
      "..FFFFFFFFFF....",
      "...FFFFFFFF.....",
      "................"
    ]
  },
  {
    id: 'pikachu',
    name: '皮卡丘头像 Pikachu',
    width: 16,
    height: 16,
    description: '可爱的宝可梦像素头像 16×16',
    pixels: [
      "B..............B",
      ".BB..........BB.",
      ".BYY........YYB.",
      "..BYYY....YYYY..",
      "..YYYYYYYYYYYY..",
      ".YYYYYYYYYYYYYY.",
      ".YYYYYYYYYYYYYY.",
      ".YBYYYYYYYYBYY..",
      ".YYYYYYYYYYYYY..",
      "RYYYYYWWYYYYYYR.",
      "RRYYYYWWYYYYYYRR",
      ".YYYYYYYYYYYYY..",
      "..YYYYPPYYYYY...",
      "...YYYYYYYYY....",
      "....YYYYYYY.....",
      "................"
    ]
  },
  {
    id: 'heart',
    name: '爱心光芒 Pixel Heart',
    width: 16,
    height: 16,
    description: '像素复古红心 16×16',
    pixels: [
      "................",
      "...RRR....RRR...",
      "..RWWWR..RRRRR..",
      ".RWWWWWRRRRRRRR.",
      ".RWWWWWRRRRRRRR.",
      ".RRWWWRRRRRRRRR.",
      "..RRRRRRRRRRRR..",
      "...RRRRRRRRRR...",
      "....RRRRRRRR....",
      ".....RRRRRR.....",
      "......RRRR......",
      ".......RR.......",
      "................",
      "................",
      "................",
      "................"
    ]
  },
  {
    id: 'cat',
    name: '甜筒猫咪 Kitty Ice Cream',
    width: 16,
    height: 16,
    description: '小猫咪甜品 16×16',
    pixels: [
      ".W...W..........",
      "WWP.PWW.........",
      "WWWWWWW.........",
      "W.B.B.W.........",
      "WW.W.WW.........",
      ".WWPWW..........",
      "..WWW...........",
      "..YYY...........",
      ".YYYYY..........",
      ".YYYYY..........",
      "..YYY...........",
      "...Y............",
      "................",
      "................",
      "................",
      "................"
    ]
  }
]

export const SAMPLE_COLOR_MAP: Record<string, [number, number, number, number]> = {
  '.': [0, 0, 0, 0], // Transparent
  'R': [226, 36, 40, 255], // Red
  'W': [255, 255, 255, 255], // White
  'B': [26, 26, 26, 255], // Black
  'F': [253, 245, 230, 255], // Ivory / Flesh
  'Y': [255, 215, 0, 255], // Yellow
  'P': [255, 105, 180, 255] // Pink
}

export function sampleToImageData(sample: SamplePattern): {
  pixels: Uint8ClampedArray
  width: number
  height: number
} {
  const { width, height, pixels } = sample
  const data = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y++) {
    const row = pixels[y] || ''
    for (let x = 0; x < width; x++) {
      const char = row[x] || '.'
      const rgba = SAMPLE_COLOR_MAP[char] || [0, 0, 0, 0]
      const idx = (y * width + x) * 4
      data[idx] = rgba[0]
      data[idx + 1] = rgba[1]
      data[idx + 2] = rgba[2]
      data[idx + 3] = rgba[3]
    }
  }

  return { pixels: data, width, height }
}
