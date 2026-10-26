import type { BeadCell, BeadColorStatItem } from './quantizer'

export interface SheetDimensionOptions {
  cellSize?: number
  rulerSize?: number
  headerHeight?: number
  margin?: number
}

export interface SheetDimensions {
  width: number
  height: number
  boardWidth: number
  boardHeight: number
  rulerSize: number
  headerHeight: number
  margin: number
  cellSize: number
}

/**
 * Calculate dimensions for the export construction drawing sheet
 */
export function calculateSheetDimensions(
  gridW: number,
  gridH: number,
  colorCount: number,
  options: SheetDimensionOptions = {}
): SheetDimensions {
  const {
    cellSize = 24,
    rulerSize = 36,
    headerHeight = 90,
    margin = 30
  } = options

  const boardWidth = gridW * cellSize
  const boardHeight = gridH * cellSize

  // Ruler on left and top
  const width = Math.max(800, boardWidth + rulerSize + margin * 2)

  // Legend section layout: 4 columns
  const cols = 4
  const rows = Math.ceil(colorCount / cols)
  const legendHeight = 40 + rows * 36 + margin

  const height = headerHeight + rulerSize + boardHeight + legendHeight + margin * 2

  return {
    width,
    height,
    boardWidth,
    boardHeight,
    rulerSize,
    headerHeight,
    margin,
    cellSize
  }
}

export function formatSheetTitle(
  paletteName: string,
  gridW: number,
  gridH: number,
  totalBeads: number,
  colorCount: number
): string {
  return `拼豆施工图纸 (${gridW}×${gridH}) · ${paletteName} · 总计 ${totalBeads} 颗 (${colorCount} 色)`
}

/**
 * Render complete construction chart to an offscreen canvas context
 */
export function renderCraftSheet(
  ctx: any,
  grid: BeadCell[][],
  paletteName: string,
  stats: Map<string, BeadColorStatItem>,
  dims: SheetDimensions
) {
  const { width, height, margin, headerHeight, rulerSize, cellSize, boardWidth, boardHeight } = dims
  const gridH = grid.length
  const gridW = grid[0].length

  // 1. Background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // 2. Header
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 26px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('拼豆施工图纸 (Bead Craft Sheet)', margin, margin + 30)

  ctx.fillStyle = '#4B5563'
  ctx.font = '14px sans-serif'
  let totalBeads = 0
  stats.forEach(s => (totalBeads += s.count))
  const subtitle = formatSheetTitle(paletteName, gridW, gridH, totalBeads, stats.size)
  ctx.fillText(subtitle, margin, margin + 60)

  // 3. Coordinate Rulers (Top & Left)
  const boardLeft = margin + rulerSize
  const boardTop = margin + headerHeight + rulerSize

  ctx.fillStyle = '#6B7280'
  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Top column numbers
  for (let x = 0; x < gridW; x++) {
    const cx = boardLeft + x * cellSize + cellSize / 2
    if ((x + 1) % 5 === 0 || x === 0 || x === gridW - 1) {
      ctx.fillText(String(x + 1), cx, boardTop - 14)
    }
  }

  // Left row numbers
  for (let y = 0; y < gridH; y++) {
    const cy = boardTop + y * cellSize + cellSize / 2
    if ((y + 1) % 5 === 0 || y === 0 || y === gridH - 1) {
      ctx.fillText(String(y + 1), boardLeft - 18, cy)
    }
  }

  // 4. Board Peg Background
  ctx.fillStyle = '#F3F4F6'
  ctx.fillRect(boardLeft, boardTop, boardWidth, boardHeight)

  // 5. Draw Beads
  const beadR = (cellSize * 0.9) / 2
  const holeR = beadR * 0.38

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const cell = grid[y][x]
      const cx = boardLeft + x * cellSize + cellSize / 2
      const cy = boardTop + y * cellSize + cellSize / 2

      if (cell.isEmpty) {
        ctx.fillStyle = '#E5E7EB'
        ctx.beginPath()
        ctx.arc(cx, cy, 2, 0, Math.PI * 2)
        ctx.fill()
        continue
      }

      // Outer bead body
      ctx.fillStyle = cell.color.hex
      ctx.beginPath()
      ctx.arc(cx, cy, beadR, 0, Math.PI * 2)
      ctx.fill()

      // Outline
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.stroke()

      // Center hole
      ctx.fillStyle = '#374151'
      ctx.beginPath()
      ctx.arc(cx, cy, holeR, 0, Math.PI * 2)
      ctx.fill()

      // Text code if cell size is large enough
      if (cellSize >= 20) {
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 8px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // Contrast drop shadow
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 2
        ctx.strokeText(cell.color.code, cx, cy)
        ctx.fillText(cell.color.code, cx, cy)
      }
    }
  }

  // 6. Grid Divider Lines (every 5 cells thicker)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
  ctx.lineWidth = 1
  for (let x = 0; x <= gridW; x++) {
    if (x % 5 === 0) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.lineWidth = 1.5
    } else {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.lineWidth = 0.5
    }
    ctx.beginPath()
    ctx.moveTo(boardLeft + x * cellSize, boardTop)
    ctx.lineTo(boardLeft + x * cellSize, boardTop + boardHeight)
    ctx.stroke()
  }

  for (let y = 0; y <= gridH; y++) {
    if (y % 5 === 0) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.lineWidth = 1.5
    } else {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.lineWidth = 0.5
    }
    ctx.beginPath()
    ctx.moveTo(boardLeft, boardTop + y * cellSize)
    ctx.lineTo(boardLeft + boardWidth, boardTop + y * cellSize)
    ctx.stroke()
  }

  // 7. Color Legend Table at Bottom
  const legendTop = boardTop + boardHeight + 35
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('色号用量清单 (Color Legend):', margin, legendTop)

  const statsList = Array.from(stats.values()).sort((a, b) => b.count - a.count)
  const colWidth = (width - margin * 2) / 4
  const startY = legendTop + 25

  statsList.forEach((item, index) => {
    const c = index % 4
    const r = Math.floor(index / 4)
    const itemX = margin + c * colWidth
    const itemY = startY + r * 32

    // Swatch
    ctx.fillStyle = item.color.hex
    ctx.beginPath()
    ctx.arc(itemX + 10, itemY + 10, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Label: "A01 (120颗)"
    ctx.fillStyle = '#1F2937'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`${item.color.code} : ${item.count} 颗`, itemX + 26, itemY + 14)
  })
}

/**
 * Save image to photo album in WeChat Mini Program or trigger download in H5
 */
export async function saveSheetImage(tempFilePath: string): Promise<boolean> {
  // #ifdef MP-WEIXIN
  return new Promise((resolve) => {
    uni.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: () => {
        uni.showToast({ title: '图纸已保存至相册', icon: 'success' })
        resolve(true)
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('auth')) {
          uni.showModal({
            title: '授权提示',
            content: '需要您的相册授权才能保存施工图纸，请前往设置开启',
            confirmText: '去开启',
            success: (modalRes) => {
              if (modalRes.confirm) {
                uni.openSetting({})
              }
            }
          })
        } else {
          uni.showToast({ title: '保存失败，请重试', icon: 'none' })
        }
        resolve(false)
      }
    })
  })
  // #endif

  // #ifndef MP-WEIXIN
  const a = document.createElement('a')
  a.href = tempFilePath
  a.download = `pindou-craft-sheet-${Date.now()}.png`
  a.click()
  return true
  // #endif
}
