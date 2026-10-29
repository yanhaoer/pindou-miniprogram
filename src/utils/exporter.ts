import type { BeadCell, BeadColorStatItem } from './quantizer'
import { getContrastTextColor } from './color-space'
import { QRCODE_BASE64 } from '@/assets/qrcode'

export interface SheetDimensionOptions {
  cellSize?: number
  rulerSize?: number
  margin?: number
}

export interface SheetDimensions {
  width: number
  height: number
  boardWidth: number
  boardHeight: number
  rulerSize: number
  margin: number
  cellSize: number
  legendRows: number
  legendCols: number
}

/**
 * Calculate dimensions for the export construction drawing sheet
 * Aligned with standard craft sheet layout (图2)
 */
export function calculateSheetDimensions(
  gridW: number,
  gridH: number,
  colorCount: number,
  options: SheetDimensionOptions = {}
): SheetDimensions {
  const {
    cellSize = 22,
    rulerSize = 28,
    margin = 20
  } = options

  const boardWidth = gridW * cellSize
  const boardHeight = gridH * cellSize

  // Width includes board + rulerSize on left + margin on both sides
  const width = Math.max(720, boardWidth + rulerSize + margin * 2)

  // Legend section layout: columns fit nicely on left side of QR code (leaving 100px on right for QR)
  const availableLegendW = width - margin * 2 - 100
  const legendCols = Math.max(4, Math.floor(availableLegendW / 76))
  const legendRows = Math.ceil(colorCount / legendCols)
  const legendHeight = 32 + legendRows * 24

  const bottomSectionHeight = Math.max(legendHeight, 105) + 10
  const height = margin + rulerSize + boardHeight + 20 + bottomSectionHeight + margin

  return {
    width,
    height,
    boardWidth,
    boardHeight,
    rulerSize,
    margin,
    cellSize,
    legendRows,
    legendCols
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
 * Perfectly aligned with the sample sheet (图2)
 */
export async function renderCraftSheet(
  ctx: any,
  grid: BeadCell[][],
  paletteName: string,
  stats: Map<string, BeadColorStatItem>,
  dims: SheetDimensions,
  canvasInstance?: any
): Promise<void> {
  const { width, height, margin, rulerSize, cellSize, boardWidth, boardHeight, legendCols } = dims
  const gridH = grid.length
  const gridW = grid[0].length

  const boardLeft = margin + rulerSize
  const boardTop = margin + rulerSize

  // 1. Background (pure white)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  // 1.5 Top-Left Sheet Title in Black Bold Heiti
  ctx.fillStyle = '#000000'
  ctx.font = 'bold 12px "SimHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('图片信息', margin, (margin + rulerSize) / 2)

  // 2. Coordinate Rulers (Top & Left) - numbers every 5 cells (1, 6, 11, 16...)
  ctx.fillStyle = '#374151'
  ctx.font = 'bold 10px monospace'

  // Top column numbers
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  for (let x = 0; x < gridW; x++) {
    const cx = boardLeft + x * cellSize + cellSize / 2
    if (x % 5 === 0 || x === gridW - 1) {
      ctx.fillText(String(x + 1), cx, boardTop - 4)
    }
  }

  // Left row numbers
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let y = 0; y < gridH; y++) {
    const cy = boardTop + y * cellSize + cellSize / 2
    if (y % 5 === 0 || y === gridH - 1) {
      ctx.fillText(String(y + 1), boardLeft - 6, cy)
    }
  }

  // 3. Draw Square Bead Cells with Color Codes
  const codeFontSize = Math.max(7, Math.min(13, Math.floor(cellSize * 0.44)))

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const cell = grid[y][x]
      const cx = boardLeft + x * cellSize
      const cy = boardTop + y * cellSize

      if (cell.isEmpty) {
        ctx.fillStyle = '#F9FAFB'
        ctx.fillRect(cx, cy, cellSize, cellSize)
      } else {
        // Cell background
        ctx.fillStyle = cell.color.hex
        ctx.fillRect(cx, cy, cellSize, cellSize)

        // Center color code
        const textColor = getContrastTextColor(cell.color.hex)
        ctx.fillStyle = textColor
        ctx.font = `bold ${codeFontSize}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cell.color.code, cx + cellSize / 2, cy + cellSize / 2)
      }

      // Thin cell outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(cx, cy, cellSize, cellSize)
    }
  }

  // 4. Grid Divider Lines (every 5 cells thicker)
  for (let x = 0; x <= gridW; x++) {
    const lx = boardLeft + x * cellSize
    const isMajor = x % 5 === 0 || x === 0 || x === gridW
    ctx.strokeStyle = isMajor ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.12)'
    ctx.lineWidth = isMajor ? 1.2 : 0.5
    ctx.beginPath()
    ctx.moveTo(lx, boardTop)
    ctx.lineTo(lx, boardTop + boardHeight)
    ctx.stroke()
  }

  for (let y = 0; y <= gridH; y++) {
    const ly = boardTop + y * cellSize
    const isMajor = y % 5 === 0 || y === 0 || y === gridH
    ctx.strokeStyle = isMajor ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.12)'
    ctx.lineWidth = isMajor ? 1.2 : 0.5
    ctx.beginPath()
    ctx.moveTo(boardLeft, ly)
    ctx.lineTo(boardLeft + boardWidth, ly)
    ctx.stroke()
  }

  // 5. Bottom Section: Color Legend (Left)
  const legendTop = boardTop + boardHeight + 18
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('颜色清单：', margin, legendTop)

  const statsList = Array.from(stats.values()).sort((a, b) => b.count - a.count)
  const itemW = 76
  const itemH = 24
  const startY = legendTop + 24

  statsList.forEach((item, index) => {
    const col = index % legendCols
    const row = Math.floor(index / legendCols)
    const ix = margin + col * itemW
    const iy = startY + row * itemH

    // Square swatch
    ctx.fillStyle = item.color.hex
    ctx.fillRect(ix, iy + 2, 13, 13)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(ix, iy + 2, 13, 13)

    // Code & count text
    ctx.fillStyle = '#1F2937'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${item.color.code} ${item.count}颗`, ix + 17, iy + 9)
  })

  // 6. Bottom Section: Mini Program QR Code (Right)
  const qrW = 70
  const qrH = 68
  const qrX = width - margin - qrW - 4
  const qrY = legendTop + 4

  // Draw QR code image
  try {
    if (canvasInstance && typeof canvasInstance.createImage === 'function') {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 600)
        const img = canvasInstance.createImage()
        img.onload = () => {
          clearTimeout(timer)
          try {
            ctx.drawImage(img, qrX, qrY, qrW, qrH)
          } catch (_) {}
          resolve()
        }
        img.onerror = () => {
          clearTimeout(timer)
          resolve()
        }
        img.src = QRCODE_BASE64
      })
    } else if (typeof Image !== 'undefined') {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 600)
        const img = new Image()
        img.onload = () => {
          clearTimeout(timer)
          try {
            ctx.drawImage(img, qrX, qrY, qrW, qrH)
          } catch (_) {}
          resolve()
        }
        img.onerror = () => {
          clearTimeout(timer)
          resolve()
        }
        img.src = QRCODE_BASE64
      })
    }
  } catch (err) {
    console.warn('QR code draw skipped', err)
  }

  // QR Code Captions
  ctx.fillStyle = '#1F2937'
  ctx.font = 'bold 9px "SimHei", "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('拼豆生成器', qrX + qrW / 2, qrY + qrH + 4)
  ctx.font = '8px sans-serif'
  ctx.fillStyle = '#6B7280'
  ctx.fillText('扫码自取图纸', qrX + qrW / 2, qrY + qrH + 16)
}

/**
 * Save image to photo album in WeChat Mini Program or trigger download in H5
 */
export async function saveSheetImage(tempFilePath: string, taroApi?: any): Promise<boolean> {
  const api =
    taroApi ||
    (typeof Taro !== 'undefined' ? Taro : null) ||
    (typeof wx !== 'undefined' ? wx : null) ||
    (globalThis as any).Taro ||
    (globalThis as any).wx ||
    (typeof window !== 'undefined' ? (window as any).Taro || (window as any).wx : null)

  if (api && typeof api.saveImageToPhotosAlbum === 'function') {
    return new Promise((resolve) => {
      api.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: () => {
          if (typeof api.showModal === 'function') {
            api.showModal({
              title: '下载成功',
              content: '高清施工图纸已成功保存到您的手机相册！',
              showCancel: false,
              confirmText: '太棒了'
            })
          }
          if (typeof api.showToast === 'function') {
            api.showToast({ title: '已保存至相册', icon: 'success', duration: 2500 })
          }
          resolve(true)
        },
        fail: (err: any) => {
          if (
            err &&
            err.errMsg &&
            (err.errMsg.includes('auth') || err.errMsg.includes('deny') || err.errMsg.includes('authorize'))
          ) {
            if (typeof api.showModal === 'function') {
              api.showModal({
                title: '需要相册权限',
                content: '需要允许保存图片到相册权限，才能保存高清施工图纸。请前往设置开启。',
                confirmText: '去设置',
                cancelText: '取消',
                success: (modalRes: any) => {
                  if (modalRes.confirm && typeof api.openSetting === 'function') {
                    api.openSetting({})
                  }
                }
              })
            }
          } else {
            if (typeof api.showToast === 'function') {
              api.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
            }
          }
          resolve(false)
        }
      })
    })
  }

  // H5 / Browser 环境
  if (typeof document !== 'undefined') {
    const a = document.createElement('a')
    a.href = tempFilePath
    a.download = `pindou-craft-sheet-${Date.now()}.png`
    a.click()
    if (api && typeof api.showToast === 'function') {
      api.showToast({ title: '图纸已开始下载', icon: 'success' })
    }
    return true
  }

  return false
}
