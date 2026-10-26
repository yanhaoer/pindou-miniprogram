import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { View, Text, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { BeadCanvas, type BeadCanvasRef } from '@/components/BeadCanvas'
import { ToolBar, type EditTool } from '@/components/ToolBar'
import { ColorPaletteBar } from '@/components/ColorPaletteBar'
import { ConfigModal } from '@/components/ConfigModal'
import { getPalette } from '@/palettes'
import type { BeadBrand, BeadColor } from '@/palettes/types'
import {
  quantizeImageData,
  getBeadColorStats,
  type BeadCell,
  type BeadColorStatItem
} from '@/utils/quantizer'
import { HistoryManager, floodFill } from '@/utils/history'
import {
  calculateSheetDimensions,
  renderCraftSheet,
  saveSheetImage
} from '@/utils/exporter'
import { SAMPLES, sampleToImageData, type SamplePattern } from '@/assets/samples'
import './index.scss'

export default function IndexPage() {
  const [currentBrand, setCurrentBrand] = useState<BeadBrand>('artkal')
  const [boardWidth, setBoardWidth] = useState(29)
  const [boardHeight, setBoardHeight] = useState(29)
  const [useDither, setUseDither] = useState(false)

  const [currentTool, setCurrentTool] = useState<EditTool>('view')
  const [selectedColorCode, setSelectedColorCode] = useState<string | null>(null)
  const [activeColor, setActiveColor] = useState<BeadColor | null>(null)

  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showSamplePicker, setShowSamplePicker] = useState(false)

  const [grid, setGrid] = useState<BeadCell[][]>([])
  const [colorStats, setColorStats] = useState<Map<string, BeadColorStatItem>>(new Map())

  const historyRef = useRef(new HistoryManager(20))
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const canvasRef = useRef<BeadCanvasRef>(null)

  // 缓存原图像素数据
  const rawImagePixelsRef = useRef<Uint8ClampedArray | null>(null)
  const rawImageWidthRef = useRef(0)
  const rawImageHeightRef = useRef(0)

  const currentPalette = useMemo(() => getPalette(currentBrand), [currentBrand])

  const updateHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo)
    setCanRedo(historyRef.current.canRedo)
  }, [])

  const refreshQuantizedGrid = useCallback((
    width = boardWidth,
    height = boardHeight,
    dither = useDither,
    palette = currentPalette
  ) => {
    if (!rawImagePixelsRef.current) return
    Taro.showLoading({ title: '色彩量化匹配中...' })

    setTimeout(() => {
      try {
        const result = quantizeImageData(
          rawImagePixelsRef.current!,
          rawImageWidthRef.current,
          rawImageHeightRef.current,
          {
            width,
            height,
            dither,
            palette
          }
        )
        setGrid(result)
        const stats = getBeadColorStats(result)
        setColorStats(stats)
        historyRef.current.clear()
        historyRef.current.pushState(result)
        updateHistoryState()

        const sortedStats = Array.from(stats.values()).sort((a, b) => b.count - a.count)
        if (sortedStats.length > 0) {
          setActiveColor(sortedStats[0].color)
        }

        canvasRef.current?.resetView()
      } finally {
        Taro.hideLoading()
      }
    }, 50)
  }, [boardWidth, boardHeight, useDither, currentPalette, updateHistoryState])

  const loadSample = useCallback((sample: SamplePattern) => {
    const imgData = sampleToImageData(sample)
    rawImagePixelsRef.current = imgData.pixels
    rawImageWidthRef.current = imgData.width
    rawImageHeightRef.current = imgData.height
    setBoardWidth(sample.width)
    setBoardHeight(sample.height)
    setShowSamplePicker(false)
    refreshQuantizedGrid(sample.width, sample.height, useDither, currentPalette)
  }, [refreshQuantizedGrid, useDither, currentPalette])

  const decodeImageToPixels = useCallback((imageSource: string) => {
    Taro.showLoading({ title: '解析图片中...' })
    const isWeApp = process.env.TARO_ENV === 'weapp'

    if (!isWeApp) {
      // H5 / Web 环境
      const img = new Image()
      if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        img.crossOrigin = 'anonymous'
      }

      img.onload = () => {
        const MAX_DIM = 600
        let w = img.width
        let h = img.height
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) {
            h = Math.round((h * MAX_DIM) / w)
            w = MAX_DIM
          } else {
            w = Math.round((w * MAX_DIM) / h)
            h = MAX_DIM
          }
        }

        const offCanvas = document.createElement('canvas')
        offCanvas.width = w
        offCanvas.height = h
        const offCtx = offCanvas.getContext('2d')
        if (!offCtx) {
          Taro.hideLoading()
          return
        }
        offCtx.drawImage(img, 0, 0, w, h)
        const imgData = offCtx.getImageData(0, 0, w, h)
        rawImagePixelsRef.current = imgData.data
        rawImageWidthRef.current = w
        rawImageHeightRef.current = h

        const maxDimension = Math.max(boardWidth, boardHeight)
        let newW = boardWidth
        let newH = boardHeight
        if (w >= h) {
          newW = maxDimension
          newH = Math.max(8, Math.round((maxDimension * h) / w))
        } else {
          newH = maxDimension
          newW = Math.max(8, Math.round((maxDimension * w) / h))
        }
        setBoardWidth(newW)
        setBoardHeight(newH)

        Taro.hideLoading()
        refreshQuantizedGrid(newW, newH, useDither, currentPalette)
      }

      img.onerror = (err) => {
        Taro.hideLoading()
        Taro.showToast({ title: '图片加载失败', icon: 'none' })
        console.error('Image load error', err)
      }

      img.src = imageSource
    } else {
      // 微信小程序环境
      Taro.getImageInfo({
        src: imageSource,
        success: (info) => {
          const maxDimension = Math.max(boardWidth, boardHeight)
          let newW = boardWidth
          let newH = boardHeight
          if (info.width >= info.height) {
            newW = maxDimension
            newH = Math.max(8, Math.round((maxDimension * info.height) / info.width))
          } else {
            newH = maxDimension
            newW = Math.max(8, Math.round((maxDimension * info.width) / info.height))
          }
          setBoardWidth(newW)
          setBoardHeight(newH)

          const query = Taro.createSelectorQuery()
          query
            .select('#exportCanvas')
            .fields({ node: true, size: true })
            .exec((res: any) => {
              if (!res || !res[0] || !res[0].node) {
                Taro.hideLoading()
                Taro.showToast({ title: '画布就绪异常', icon: 'none' })
                return
              }
              const expCanvas = res[0].node
              const expCtx = expCanvas.getContext('2d')
              const img = expCanvas.createImage()
              img.onload = () => {
                const MAX_DIM = 600
                let w = info.width
                let h = info.height
                if (w > MAX_DIM || h > MAX_DIM) {
                  if (w > h) {
                    h = Math.round((h * MAX_DIM) / w)
                    w = MAX_DIM
                  } else {
                    w = Math.round((w * MAX_DIM) / h)
                    h = MAX_DIM
                  }
                }
                expCanvas.width = w
                expCanvas.height = h
                expCtx.drawImage(img, 0, 0, w, h)
                const imgData = expCtx.getImageData(0, 0, w, h)
                rawImagePixelsRef.current = imgData.data
                rawImageWidthRef.current = w
                rawImageHeightRef.current = h
                Taro.hideLoading()
                refreshQuantizedGrid(newW, newH, useDither, currentPalette)
              }
              img.onerror = () => {
                Taro.hideLoading()
                Taro.showToast({ title: '小程序图片解码失败', icon: 'none' })
              }
              img.src = imageSource
            })
        },
        fail: () => {
          Taro.hideLoading()
          Taro.showToast({ title: '获取图片信息失败', icon: 'none' })
        }
      })
    }
  }, [boardWidth, boardHeight, refreshQuantizedGrid, useDither, currentPalette])

  const handlePickImage = useCallback(() => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0]
        if (tempPath) {
          decodeImageToPixels(tempPath)
        }
      },
      fail: (err) => {
        console.log('User cancelled or failed to choose image', err)
      }
    })
  }, [decodeImageToPixels])

  const handleCellClick = useCallback(({ x, y, cell }: { x: number; y: number; cell: BeadCell }) => {
    if (currentTool === 'view') {
      if (!cell.isEmpty) {
        if (selectedColorCode === cell.color.code) {
          setSelectedColorCode(null)
        } else {
          setSelectedColorCode(cell.color.code)
          setActiveColor(cell.color)
        }
      }
      return
    }

    if (currentTool === 'eyedropper') {
      if (!cell.isEmpty) {
        setActiveColor(cell.color)
        setSelectedColorCode(cell.color.code)
        Taro.showToast({ title: `已吸取 ${cell.color.code}`, icon: 'none' })
        setCurrentTool('pencil')
      }
      return
    }

    if (currentTool === 'pencil') {
      if (!activeColor) return
      setGrid(prev => {
        const next = prev.map(row => row.map(c => ({ ...c })))
        next[y][x].color = { ...activeColor }
        next[y][x].isEmpty = false
        setColorStats(getBeadColorStats(next))
        historyRef.current.pushState(next)
        updateHistoryState()
        return next
      })
      return
    }

    if (currentTool === 'eraser') {
      setGrid(prev => {
        const next = prev.map(row => row.map(c => ({ ...c })))
        next[y][x].isEmpty = true
        setColorStats(getBeadColorStats(next))
        historyRef.current.pushState(next)
        updateHistoryState()
        return next
      })
      return
    }

    if (currentTool === 'bucket') {
      if (!activeColor) return
      setGrid(prev => {
        const next = prev.map(row => row.map(c => ({ ...c })))
        const affected = floodFill(next, x, y, activeColor)
        if (affected > 0) {
          setColorStats(getBeadColorStats(next))
          historyRef.current.pushState(next)
          updateHistoryState()
          return next
        }
        return prev
      })
    }
  }, [currentTool, selectedColorCode, activeColor, updateHistoryState])

  const handleUndo = useCallback(() => {
    const prev = historyRef.current.undo()
    if (prev) {
      setGrid(prev)
      setColorStats(getBeadColorStats(prev))
      updateHistoryState()
    }
  }, [updateHistoryState])

  const handleRedo = useCallback(() => {
    const next = historyRef.current.redo()
    if (next) {
      setGrid(next)
      setColorStats(getBeadColorStats(next))
      updateHistoryState()
    }
  }, [updateHistoryState])

  const handleApplyConfig = useCallback((payload: {
    brand: BeadBrand
    width: number
    height: number
    dither: boolean
  }) => {
    setCurrentBrand(payload.brand)
    setBoardWidth(payload.width)
    setBoardHeight(payload.height)
    setUseDither(payload.dither)
    const newPalette = getPalette(payload.brand)
    refreshQuantizedGrid(payload.width, payload.height, payload.dither, newPalette)
  }, [refreshQuantizedGrid])

  const handleExportSheet = useCallback(async () => {
    if (!grid || grid.length === 0) {
      Taro.showToast({ title: '暂无图纸数据', icon: 'none' })
      return
    }

    Taro.showLoading({ title: '正在渲染高清图纸...' })

    const dims = calculateSheetDimensions(
      grid[0].length,
      grid.length,
      colorStats.size,
      { cellSize: 26, rulerSize: 40, headerHeight: 90, margin: 30 }
    )

    const isWeApp = process.env.TARO_ENV === 'weapp'

    if (!isWeApp) {
      const offCanvas = document.createElement('canvas')
      offCanvas.width = dims.width
      offCanvas.height = dims.height
      const offCtx = offCanvas.getContext('2d')
      if (offCtx) {
        renderCraftSheet(offCtx, grid, currentPalette.name, colorStats, dims)
        const dataUrl = offCanvas.toDataURL('image/png')
        Taro.hideLoading()
        saveSheetImage(dataUrl)
      } else {
        Taro.hideLoading()
      }
    } else {
      const query = Taro.createSelectorQuery()
      query
        .select('#exportCanvas')
        .fields({ node: true, size: true })
        .exec((res: any) => {
          if (!res || !res[0] || !res[0].node) {
            Taro.hideLoading()
            return
          }
          const expCanvas = res[0].node
          expCanvas.width = dims.width
          expCanvas.height = dims.height
          const expCtx = expCanvas.getContext('2d')

          renderCraftSheet(expCtx, grid, currentPalette.name, colorStats, dims)

          Taro.canvasToTempFilePath({
            canvas: expCanvas,
            fileType: 'png',
            quality: 1,
            success: (saveRes) => {
              Taro.hideLoading()
              saveSheetImage(saveRes.tempFilePath)
            },
            fail: () => {
              Taro.hideLoading()
              Taro.showToast({ title: '导出失败', icon: 'none' })
            }
          })
        })
    }
  }, [grid, colorStats, currentPalette])

  // 首屏挂载加载默认超级蘑菇
  useEffect(() => {
    loadSample(SAMPLES[0])
  }, [loadSample])

  return (
    <View className="app-container">
      {/* 顶部状态与主操作栏 */}
      <View className="top-nav">
        <View className="brand-title">
          <Text className="app-icon">🎨</Text>
          <View className="title-meta">
            <Text className="main-title">拼豆生成器</Text>
            <Text className="sub-title">
              {currentPalette.name} · {boardWidth}×{boardHeight}
            </Text>
          </View>
        </View>

        <View className="nav-actions">
          <View className="nav-btn secondary" onClick={() => setShowSamplePicker(true)}>
            <Text>样例</Text>
          </View>
          <View className="nav-btn secondary" onClick={handlePickImage}>
            <Text>选图</Text>
          </View>
          <View className="nav-btn primary" onClick={handleExportSheet}>
            <Text>导出图纸</Text>
          </View>
        </View>
      </View>

      {/* 微调工具栏 */}
      <ToolBar
        currentTool={currentTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onSelectTool={setCurrentTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenConfig={() => setShowConfigModal(true)}
      />

      {/* 中间主视图画布 */}
      <View className="canvas-viewport">
        <BeadCanvas
          ref={canvasRef}
          grid={grid}
          selectedColorCode={selectedColorCode}
          tool={currentTool}
          activeColor={activeColor}
          onCellClick={handleCellClick}
        />
      </View>

      {/* 底部色号清单与寻豆面板 */}
      <ColorPaletteBar
        stats={colorStats}
        selectedColorCode={selectedColorCode}
        activeColor={activeColor}
        onSelectColorCode={setSelectedColorCode}
        onSelectActiveColor={setActiveColor}
      />

      {/* 参数配置弹窗 */}
      <ConfigModal
        visible={showConfigModal}
        brand={currentBrand}
        width={boardWidth}
        height={boardHeight}
        dither={useDither}
        onClose={() => setShowConfigModal(false)}
        onApply={handleApplyConfig}
      />

      {/* 样图选择弹层 */}
      {showSamplePicker && (
        <View className="picker-overlay" onClick={() => setShowSamplePicker(false)}>
          <View className="picker-modal" onClick={e => e.stopPropagation()}>
            <View className="picker-header">
              <Text className="picker-title">选择内置经典像素样例</Text>
              <View className="close-btn" onClick={() => setShowSamplePicker(false)}>
                ✕
              </View>
            </View>
            <View className="sample-grid">
              {SAMPLES.map(sample => (
                <View
                  key={sample.id}
                  className="sample-card"
                  onClick={() => loadSample(sample)}
                >
                  <Text className="sample-icon">👾</Text>
                  <Text className="sample-name">{sample.name}</Text>
                  <Text className="sample-desc">{sample.description}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 离屏 Canvas */}
      <View className="offscreen-wrapper">
        <Canvas id="exportCanvas" canvasId="exportCanvas" type="2d" className="export-canvas" />
      </View>
    </View>
  )
}
