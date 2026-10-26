export type BeadBrand = 'artkal' | 'perler' | 'mard'

export interface BeadColor {
  code: string
  name: string
  hex: string
  r: number
  g: number
  b: number
  lab: [number, number, number]
  brand: BeadBrand
}

export interface RawBeadColor {
  code: string
  name: string
  hex: string
}

export interface BeadPalette {
  id: BeadBrand
  name: string
  description: string
  colors: BeadColor[]
}
