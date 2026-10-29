import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { RootPortal, View, Text, Canvas, Image } from '@tarojs/components'
import Taro, { useRouter, useLoad } from '@tarojs/taro'
import { BeadCanvas, type BeadCanvasRef } from '@/components/BeadCanvas'
import { ToolBar, type EditTool } from '@/components/ToolBar'
import { ColorPaletteBar } from '@/components/ColorPaletteBar'
import { QuickActionBar } from '@/components/QuickActionBar'
import { DrawingInfoCard } from '@/components/DrawingInfoCard'
import { ConfigModal } from '@/components/ConfigModal'
import { FullColorPickerSheet } from '@/components/FullColorPickerSheet'
import { getPalette } from '@/palettes'
import type { BeadBrand, BeadColor } from '@/palettes/types'
import {
  quantizeImageData,
  getBeadColorStats,
  mirrorGridHorizontal,
  mirrorRawPixelsHorizontal,
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
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.scss'

export type ThemeMode = 'dark' | 'light'

function IndexPageInner() {
  console.log('[IndexPageInner] Component render started')
  const router = useRouter()
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = Taro.getStorageSync('pindou_theme')
      if (saved === 'light' || saved === 'dark') return saved
      if (typeof Taro.getSystemInfoSync === 'function') {
        const sys = Taro.getSystemInfoSync()
        if (sys && sys.theme === 'light') return 'light'
      }
    } catch (e) {}
    return 'dark'
  })

  const [currentBrand, setCurrentBrand] = useState<BeadBrand>('artkal')
  const [boardWidth, setBoardWidth] = useState(29)
  const [boardHeight, setBoardHeight] = useState(29)
  const [useDither, setUseDither] = useState(false)

  const [currentTool, setCurrentTool] = useState<EditTool>('view')
  const [selectedColorCode, setSelectedColorCode] = useState<string | null>(null)
  const [activeColor, setActiveColor] = useState<BeadColor | null>(null)

  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showSamplePicker, setShowSamplePicker] = useState(false)
  const [showColorCodes, setShowColorCodes] = useState(false)
  const [showRulers, setShowRulers] = useState(false)
  const [showFullColorPicker, setShowFullColorPicker] = useState(false)
  const [colorPickerTargetPos, setColorPickerTargetPos] = useState<{ x: number; y: number } | null>(null)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)

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
  const hasLoadedInitialSampleRef = useRef(false)

  const currentPalette = useMemo(() => getPalette(currentBrand), [currentBrand])

  const updateHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo)
    setCanRedo(historyRef.current.canRedo)
  }, [])

  // 动态同步小程序原生导航栏色彩与标题
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.setNavigationBarColor({
        frontColor: theme === 'dark' ? '#ffffff' : '#000000',
        backgroundColor: theme === 'dark' ? '#16171d' : '#ffffff',
        animation: { duration: 200, timingFunc: 'linear' }
      }).catch(() => {})

      Taro.setNavigationBarTitle({
        title: `拼豆生成器 (${boardWidth}×${boardHeight})`
      }).catch(() => {})
    }
  }, [theme, boardWidth, boardHeight])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      try {
        Taro.setStorageSync('pindou_theme', next)
      } catch (e) {}
      return next
    })
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
    setOriginalImageUrl(null)
    setShowSamplePicker(false)
    refreshQuantizedGrid(sample.width, sample.height, useDither, currentPalette)
  }, [refreshQuantizedGrid, useDither, currentPalette])

  const decodeImageToPixels = useCallback((
    imageSource: string,
    targetW?: number,
    targetH?: number,
    targetPalette?: any
  ) => {
    setOriginalImageUrl(imageSource)
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

        const baseW = targetW ?? boardWidth
        const baseH = targetH ?? boardHeight
        const pal = targetPalette ?? currentPalette
        const maxDimension = Math.max(baseW, baseH)
        let newW = baseW
        let newH = baseH
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
        refreshQuantizedGrid(newW, newH, useDither, pal)
      }

      img.onerror = (err) => {
        Taro.hideLoading()
        Taro.showToast({ title: '图片加载失败', icon: 'none' })
        console.error('Image load error', err)
      }

      img.src = imageSource
    } else {
      // 微信小程序环境：优先使用高稳定性原生离屏 Canvas 2D，无需依赖 DOM 挂载时机
      Taro.getImageInfo({
        src: imageSource,
        success: (info) => {
          const baseW = targetW ?? boardWidth
          const baseH = targetH ?? boardHeight
          const pal = targetPalette ?? currentPalette
          const maxDimension = Math.max(baseW, baseH)
          let newW = baseW
          let newH = baseH
          if (info.width >= info.height) {
            newW = maxDimension
            newH = Math.max(8, Math.round((maxDimension * info.height) / info.width))
          } else {
            newH = maxDimension
            newW = Math.max(8, Math.round((maxDimension * info.width) / info.height))
          }
          setBoardWidth(newW)
          setBoardHeight(newH)

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

          const realSrc = info.path || imageSource
          let isProcessed = false

          // 核心解码逻辑：使用实际 DOM 中已就绪的 2D Canvas 节点加载图像并读取像素
          const runCanvasDecode = () => {
            let retry = 0
            const tryQuery = () => {
              if (isProcessed) return
              const query = Taro.createSelectorQuery()
              query
                .select('#exportCanvas')
                .fields({ node: true, size: true })
                .exec((res: any) => {
                  if (isProcessed) return
                  if (!res || !res[0] || !res[0].node) {
                    if (retry < 25) {
                      retry++
                      setTimeout(tryQuery, 50)
                      return
                    }
                    console.warn('#exportCanvas query timed out, trying offscreen fallback')
                    tryOffscreenDecode()
                    return
                  }

                  const expCanvas = res[0].node
                  const expCtx = expCanvas.getContext('2d')
                  const img = expCanvas.createImage()
                  let timer: any = null

                  const handleSuccess = () => {
                    if (isProcessed) return
                    if (timer) clearTimeout(timer)
                    try {
                      expCanvas.width = w
                      expCanvas.height = h
                      expCtx.clearRect(0, 0, w, h)
                      expCtx.drawImage(img, 0, 0, w, h)
                      const imgData = expCtx.getImageData(0, 0, w, h)
                      // 提取完像素数据立即清空底层画板，避免在屏幕上残留原图
                      expCtx.clearRect(0, 0, w, h)

                      // 校验像素数据：确保不是全透明空像素
                      let hasValidPixel = false
                      const step = Math.max(1, Math.floor(imgData.data.length / 500))
                      for (let i = 3; i < imgData.data.length; i += step * 4) {
                        if (imgData.data[i] > 10) {
                          hasValidPixel = true
                          break
                        }
                      }

                      if (!hasValidPixel) {
                        console.warn('expCanvas getImageData returned all transparent pixels, trying offscreen fallback')
                        tryOffscreenDecode()
                        return
                      }

                      isProcessed = true
                      rawImagePixelsRef.current = imgData.data
                      rawImageWidthRef.current = w
                      rawImageHeightRef.current = h
                      Taro.hideLoading()
                      refreshQuantizedGrid(newW, newH, useDither, pal)
                    } catch (e) {
                      console.error('expCanvas drawImage/getImageData failed', e)
                      tryOffscreenDecode()
                    }
                  }

                  const handleFail = () => {
                    if (isProcessed) return
                    if (timer) clearTimeout(timer)
                    console.warn('expCanvas img load failed, trying offscreen')
                    tryOffscreenDecode()
                  }

                  img.onload = handleSuccess
                  img.onerror = handleFail
                  timer = setTimeout(handleFail, 3000)
                  img.src = realSrc
                })
            }
            tryQuery()
          }

          // 备选兜底：原生离屏 Canvas
          const tryOffscreenDecode = () => {
            if (isProcessed) return
            let offscreenCanvas: any = null
            try {
              if (typeof (wx as any) !== 'undefined' && typeof (wx as any).createOffscreenCanvas === 'function') {
                offscreenCanvas = (wx as any).createOffscreenCanvas({ type: '2d', width: w, height: h })
              } else if (typeof (Taro as any).createOffscreenCanvas === 'function') {
                offscreenCanvas = (Taro as any).createOffscreenCanvas({ type: '2d', width: w, height: h })
              }
            } catch (e) {
              console.warn('createOffscreenCanvas error', e)
            }

            if (offscreenCanvas) {
              try {
                const expCtx = offscreenCanvas.getContext('2d')
                const img = offscreenCanvas.createImage()
                let timer: any = null

                const onDone = () => {
                  if (isProcessed) return
                  isProcessed = true
                  if (timer) clearTimeout(timer)
                  try {
                    expCtx.clearRect(0, 0, w, h)
                    expCtx.drawImage(img, 0, 0, w, h)
                    const imgData = expCtx.getImageData(0, 0, w, h)
                    expCtx.clearRect(0, 0, w, h)
                    rawImagePixelsRef.current = imgData.data
                    rawImageWidthRef.current = w
                    rawImageHeightRef.current = h
                    Taro.hideLoading()
                    refreshQuantizedGrid(newW, newH, useDither, pal)
                  } catch (drawErr) {
                    fallbackToSample('图片像素读取失败')
                  }
                }

                const onError = () => {
                  if (isProcessed) return
                  if (timer) clearTimeout(timer)
                  fallbackToSample('图片加载失败')
                }

                img.onload = onDone
                img.onerror = onError
                timer = setTimeout(onError, 2500)
                img.src = realSrc
                return
              } catch (canvasErr) {
                console.warn('Offscreen canvas setup error', canvasErr)
              }
            }

            fallbackToSample('无法初始化画布环境')
          }

          const fallbackToSample = (msg: string) => {
            if (isProcessed) return
            isProcessed = true
            Taro.hideLoading()
            Taro.showToast({ title: `${msg}，已载入示例图`, icon: 'none', duration: 2500 })
            loadSample(SAMPLES[0])
          }

          // 优先启动 DOM Canvas 解码
          runCanvasDecode()
        },
        fail: (err) => {
          Taro.hideLoading()
          Taro.showToast({ title: '获取图片信息失败，已载入示例图', icon: 'none' })
          console.error('getImageInfo fail', err)
          loadSample(SAMPLES[0])
        }
      })
    }
  }, [boardWidth, boardHeight, refreshQuantizedGrid, useDither, currentPalette, loadSample])

  const handlePickImage = useCallback(() => {
    const onChosen = (tempPath: string) => {
      if (tempPath) {
        decodeImageToPixels(tempPath)
      }
    }

    if (typeof (Taro as any).chooseMedia === 'function') {
      ;(Taro as any).chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: (res: any) => {
          const path = res.tempFiles?.[0]?.tempFilePath || res.tempFiles?.[0]?.path
          if (path) {
            onChosen(path)
          } else {
            fallbackChoose()
          }
        },
        fail: () => {
          fallbackChoose()
        }
      })
    } else {
      fallbackChoose()
    }

    function fallbackChoose() {
      Taro.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const tempPath = (res.tempFilePaths && res.tempFilePaths[0]) || (res.tempFiles && res.tempFiles[0] && ((res.tempFiles[0] as any).path || (res.tempFiles[0] as any).tempFilePath))
          if (tempPath) {
            onChosen(tempPath)
          }
        },
        fail: (err) => {
          console.log('User cancelled or failed to choose image', err)
        }
      })
    }
  }, [decodeImageToPixels])

  const handleCellClick = useCallback(({ x, y, cell }: { x: number; y: number; cell: BeadCell }) => {
    if (currentTool === 'view') {
      // 平移漫游模式：用于纯浏览与拖动，不切换选色或暗化画布
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
      canvasRef.current?.getSnapshot?.()
      setColorPickerTargetPos({ x, y })
      setShowFullColorPicker(true)
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

  const handleSelectFullColor = useCallback((selectedColor: BeadColor, pos: { x: number; y: number }) => {
    setGrid(prev => {
      const next = prev.map(row => row.map(c => ({ ...c })))
      next[pos.y][pos.x].color = { ...selectedColor }
      next[pos.y][pos.x].isEmpty = false
      setColorStats(getBeadColorStats(next))
      historyRef.current.pushState(next)
      updateHistoryState()
      return next
    })
    setActiveColor(selectedColor)
    setSelectedColorCode(selectedColor.code)
    setShowFullColorPicker(false)
    Taro.showToast({
      title: `已更改 (${pos.x + 1}, ${pos.y + 1}) 为 ${selectedColor.code}`,
      icon: 'none',
      duration: 1500
    })
  }, [updateHistoryState])

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

  const handleMirrorHorizontal = useCallback(() => {
    if (!grid || grid.length === 0) return
    const nextGrid = mirrorGridHorizontal(grid)
    setGrid(nextGrid)
    setColorStats(getBeadColorStats(nextGrid))
    historyRef.current.pushState(nextGrid)
    updateHistoryState()

    if (rawImagePixelsRef.current && rawImageWidthRef.current > 0) {
      rawImagePixelsRef.current = mirrorRawPixelsHorizontal(
        rawImagePixelsRef.current,
        rawImageWidthRef.current,
        rawImageHeightRef.current
      )
    }
    Taro.showToast({ title: '已水平镜像', icon: 'none', duration: 1000 })
  }, [grid, updateHistoryState])

  const handleToggleColorCodes = useCallback(() => {
    setShowColorCodes(prev => !prev)
  }, [])

  const handleToggleRulers = useCallback(() => {
    setShowRulers(prev => !prev)
  }, [])

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
      { cellSize: 22, rulerSize: 28, margin: 20 }
    )

    const isWeApp = process.env.TARO_ENV === 'weapp'

    if (!isWeApp) {
      const offCanvas = document.createElement('canvas')
      offCanvas.width = dims.width
      offCanvas.height = dims.height
      const offCtx = offCanvas.getContext('2d')
      if (offCtx) {
        await renderCraftSheet(offCtx, grid, currentPalette.name, colorStats, dims, offCanvas)
        const dataUrl = offCanvas.toDataURL('image/png')
        Taro.hideLoading()
        await saveSheetImage(dataUrl, Taro)
      } else {
        Taro.hideLoading()
        Taro.showToast({ title: '初始化画布失败', icon: 'none' })
      }
    } else {
      let retryCount = 0
      const executeExport = () => {
        const query = Taro.createSelectorQuery()
        query
          .select('#exportCanvas')
          .fields({ node: true, size: true })
          .exec(async (res: any) => {
            if (!res || !res[0] || !res[0].node) {
              if (retryCount < 8) {
                retryCount++
                setTimeout(executeExport, 100)
                return
              }
              Taro.hideLoading()
              Taro.showToast({ title: '图纸画布未就绪，请重试', icon: 'none' })
              return
            }
            const expCanvas = res[0].node
            expCanvas.width = dims.width
            expCanvas.height = dims.height
            const expCtx = expCanvas.getContext('2d')

            try {
              await renderCraftSheet(expCtx, grid, currentPalette.name, colorStats, dims, expCanvas)

              Taro.canvasToTempFilePath({
                canvas: expCanvas,
                width: dims.width,
                height: dims.height,
                destWidth: dims.width,
                destHeight: dims.height,
                fileType: 'png',
                quality: 1,
                success: async (saveRes) => {
                  Taro.hideLoading()
                  await saveSheetImage(saveRes.tempFilePath, Taro)
                },
                fail: (err) => {
                  console.error('canvasToTempFilePath error', err)
                  Taro.hideLoading()
                  Taro.showToast({ title: '保存图片失败，请重试', icon: 'none' })
                }
              })
            } catch (renderErr) {
              console.error('renderCraftSheet error', renderErr)
              Taro.hideLoading()
              Taro.showToast({ title: '图纸渲染异常，请重试', icon: 'none' })
            }
          })
      }
      executeExport()
    }
  }, [grid, colorStats, currentPalette])

  const initFromParams = useCallback((params: Record<string, any>) => {
    if (hasLoadedInitialSampleRef.current) return
    if (!params) return
    const { width, height, brand, imagePath } = params
    if (!width && !height && !brand && !imagePath) return

    hasLoadedInitialSampleRef.current = true
    const targetW = Number(width) || boardWidth
    const targetH = Number(height) || boardHeight
    const targetBrand = (brand as BeadBrand) || currentBrand

    if (width) setBoardWidth(targetW)
    if (height) setBoardHeight(targetH)
    if (brand) setCurrentBrand(targetBrand)

    if (imagePath) {
      let cleanPath = imagePath
      try {
        cleanPath = decodeURIComponent(imagePath)
      } catch (e) {
        cleanPath = imagePath
      }
      decodeImageToPixels(
        cleanPath,
        targetW,
        targetH,
        getPalette(targetBrand)
      )
    } else {
      loadSample(SAMPLES[0])
    }
  }, [boardWidth, boardHeight, currentBrand, decodeImageToPixels, loadSample])

  // 微信小程序原生生命周期 onLoad：优先从此处提取参数
  useLoad((options: any) => {
    initFromParams(options)
  })

  // 兼容 Taro 路由上下文 router.params 监听
  useEffect(() => {
    if (router.params && (router.params.imagePath || router.params.width)) {
      initFromParams(router.params)
    }
  }, [router.params, initFromParams])

  // 无参数直接进入时默认加载样图兜底
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasLoadedInitialSampleRef.current) {
        hasLoadedInitialSampleRef.current = true
        loadSample(SAMPLES[0])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [loadSample])

  const handlePreviewOriginalImage = useCallback(() => {
    if (originalImageUrl) {
      Taro.previewImage({
        current: originalImageUrl,
        urls: [originalImageUrl]
      })
    }
  }, [originalImageUrl])

  const handleBackHome = () => {
    Taro.navigateBack().catch(() => {
      Taro.redirectTo({ url: '/pages/home/index' })
    })
  }

  const totalBeadCount = useMemo(() => {
    let sum = 0
    colorStats.forEach(item => {
      sum += item.count
    })
    return sum
  }, [colorStats])

  const isAnyModalOpen = showFullColorPicker || showConfigModal || showSamplePicker

  return (
    <View className={`app-container theme-${theme}`}>
      {/* 微调工具栏 */}
      <ToolBar
        currentTool={currentTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onSelectTool={setCurrentTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* 中间主视图画布 */}
      <View className="canvas-viewport" catchMove={true}>
        <BeadCanvas
          ref={canvasRef}
          grid={grid}
          selectedColorCode={selectedColorCode}
          tool={currentTool}
          theme={theme}
          showColorCodes={showColorCodes}
          showRulers={showRulers}
          activeColor={activeColor}
          isOverlayActive={isAnyModalOpen}
          onCellClick={handleCellClick}
        />

        {/* 左下角原图微型缩略图悬浮卡片 */}
        {originalImageUrl && (
          <View
            className="original-image-preview"
            onClick={handlePreviewOriginalImage}
            title="点击查看原图大图"
          >
            <Image src={originalImageUrl} mode="aspectFill" className="preview-thumb-img" />
            <View className="preview-thumb-badge">
              <Text className="thumb-badge-text">原图</Text>
            </View>
          </View>
        )}
      </View>

      {/* 色号清单上方：快捷操作栏 */}
      <QuickActionBar
        showColorCodes={showColorCodes}
        showRulers={showRulers}
        onToggleColorCodes={handleToggleColorCodes}
        onToggleRulers={handleToggleRulers}
        onMirrorHorizontal={handleMirrorHorizontal}
        onOpenConfig={() => {
          canvasRef.current?.getSnapshot?.()
          setShowConfigModal(true)
        }}
      />

      {/* 色号清单与寻豆面板 */}
      <ColorPaletteBar
        stats={colorStats}
        selectedColorCode={selectedColorCode}
        activeColor={activeColor}
        onSelectColorCode={setSelectedColorCode}
        onSelectActiveColor={setActiveColor}
      />

      {/* 色号清单下方：图纸信息面板 */}
      <DrawingInfoCard
        width={boardWidth}
        height={boardHeight}
        totalBeads={totalBeadCount}
        colorCount={colorStats.size}
      />

      {/* 图纸信息面板下方：醒目大号下载图纸按钮 */}
      <View className="export-action-card">
        <View className="download-sheet-btn" onClick={handleExportSheet}>
          <Text className="btn-icon">📥</Text>
          <Text className="btn-text">下载高清施工图纸</Text>
        </View>
        <Text className="btn-hint">全幅对齐标准施工图纸 · 含坐标与色号清单 · 自动保存相册</Text>
      </View>

      {/* 参数配置弹窗 */}
      <ConfigModal
        visible={showConfigModal}
        brand={currentBrand}
        width={boardWidth}
        height={boardHeight}
        dither={useDither}
        onClose={() => setShowConfigModal(false)}
        onApply={handleApplyConfig}
        onPickImage={handlePickImage}
        onSelectSample={() => {
          canvasRef.current?.getSnapshot?.()
          setShowSamplePicker(true)
        }}
      />

      {/* 全量色号选择抽屉 */}
      {showFullColorPicker && (
        <FullColorPickerSheet
          visible={showFullColorPicker}
          brand={currentBrand}
          targetPos={colorPickerTargetPos}
          currentCellColor={
            colorPickerTargetPos && grid[colorPickerTargetPos.y]
              ? grid[colorPickerTargetPos.y][colorPickerTargetPos.x]?.color
              : null
          }
          inUseColors={Array.from(colorStats.values()).map(s => s.color)}
          onClose={() => setShowFullColorPicker(false)}
          onSelectColor={handleSelectFullColor}
        />
      )}

      {/* 样图选择弹层 */}
      {showSamplePicker && (
        <RootPortal enable>
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
        </RootPortal>
      )}

      {/* 离屏 Canvas */}
      <View className="offscreen-wrapper">
        <Canvas id="exportCanvas" canvasId="exportCanvas" type="2d" className="export-canvas" />
      </View>
    </View>
  )
}

export default function IndexPage() {
  return (
    <ErrorBoundary>
      <IndexPageInner />
    </ErrorBoundary>
  )
}

