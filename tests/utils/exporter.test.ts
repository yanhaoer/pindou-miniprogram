import { describe, it, expect, vi } from 'vitest'
import { calculateSheetDimensions, formatSheetTitle, saveSheetImage } from '@/utils/exporter'

describe('Bead Craft Sheet Exporter System', () => {
  it('calculates proper high-res export sheet dimensions', () => {
    // 50x50 board with 18 distinct colors
    const dims = calculateSheetDimensions(50, 50, 18, {
      cellSize: 22,
      rulerSize: 28,
      margin: 20
    })

    // Board area = 50 * 22 = 1100px
    expect(dims.boardWidth).toBe(1100)
    expect(dims.boardHeight).toBe(1100)
    // Total width = boardArea + rulerSize + 2 * margin = 1100 + 28 + 40 = 1168px
    expect(dims.width).toBe(1168)
    // Height includes ruler + board + legend table + margins
    expect(dims.height).toBeGreaterThan(1200)
    expect(dims.cellSize).toBe(22)
  })

  it('ensures minimum canvas width for small boards', () => {
    const dims = calculateSheetDimensions(10, 10, 5)
    expect(dims.width).toBeGreaterThanOrEqual(720)
  })

  it('formats clean craft sheet header info string', () => {
    const title = formatSheetTitle('Artkal 阿特卡', 50, 50, 2500, 15)
    expect(title).toContain('50×50')
    expect(title).toContain('Artkal')
    expect(title).toContain('2500')
    expect(title).toContain('15')
  })

  it('invokes saveImageToPhotosAlbum and displays success modal when taroApi provided', async () => {
    const mockApi = {
      saveImageToPhotosAlbum: vi.fn(({ success }) => {
        success()
      }),
      showModal: vi.fn(),
      showToast: vi.fn()
    }

    const res = await saveSheetImage('temp/path/test.png', mockApi)
    expect(res).toBe(true)
    expect(mockApi.saveImageToPhotosAlbum).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'temp/path/test.png' })
    )
    expect(mockApi.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '下载成功',
        confirmText: '太棒了'
      })
    )
    expect(mockApi.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '已保存至相册',
        icon: 'success'
      })
    )
  })

  it('handles auth rejection gracefully and shows permission modal', async () => {
    const mockApi = {
      saveImageToPhotosAlbum: vi.fn(({ fail }) => {
        fail({ errMsg: 'saveImageToPhotosAlbum:fail auth deny' })
      }),
      showModal: vi.fn(),
      showToast: vi.fn()
    }

    const res = await saveSheetImage('temp/path/test.png', mockApi)
    expect(res).toBe(false)
    expect(mockApi.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '需要相册权限'
      })
    )
  })
})
