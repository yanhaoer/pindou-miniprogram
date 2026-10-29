import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback
} from 'react'
import { View, Canvas, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { BeadCell } from '@/utils/quantizer'
import type { BeadColor } from '@/palettes/types'
import {
  clampScale,
  screenToGrid,
  calculateTouchDistance,
  calculateTouchCenter,
  clampViewportBounds,
  getCanvasRelativeCoords,
  type Viewport
} from '@/utils/gesture'
import {
  getContrastTextColor,
  shouldShowColorCode,
  computeColorCodeFontSize
} from '@/utils/color-space'
import {
  getRulerBandSize,
  shouldShowRulerTickNumber,
  computeRulerFontSize
} from '@/utils/ruler'
import './BeadCanvas.scss'

export { getContrastTextColor } from '@/utils/color-space'

export interface BeadCanvasRef {
  render: () => void
  resetView: () => void
  getSnapshot?: () => string | null
}

export interface BeadCanvasProps {
  grid: BeadCell[][]
  selectedColorCode?: string | null
  tool?: 'view' | 'pencil' | 'eyedropper' | 'bucket' | 'eraser'
  activeColor?: BeadColor | null
  baseCellSize?: number
  theme?: 'dark' | 'light'
  showColorCodes?: boolean
  showRulers?: boolean
  isOverlayActive?: boolean
  onToggleColorCodes?: (show: boolean) => void
  onCellClick?: (payload: { x: number; y: number; cell: BeadCell }) => void
  onPickColor?: (color: BeadColor) => void
}

export const BeadCanvas = forwardRef<BeadCanvasRef, BeadCanvasProps>((props, ref) => {
  const {
    grid,
    selectedColorCode = null,
    tool = 'view',
    baseCellSize = 22,
    theme = 'dark',
    showRulers = false,
    onCellClick,
    onPickColor
  } = props

  const canvasNodeRef = useRef<any>(null)
  const ctxRef = useRef<any>(null)
  const canvasWidthRef = useRef(360)
  const canvasHeightRef = useRef(480)
  const dprRef = useRef(1)
  const canvasRectRef = useRef({ left: 0, top: 0, width: 360, height: 480 })

  const updateCanvasRect = useCallback(() => {
    const isWeApp = process.env.TARO_ENV === 'weapp'
    if (isWeApp) {
      const query = Taro.createSelectorQuery()
      query.select('#beadCanvas').boundingClientRect((rect: any) => {
        if (rect) {
          canvasRectRef.current = {
            left: rect.left || 0,
            top: rect.top || 0,
            width: rect.width || 360,
            height: rect.height || 480
          }
        }
      }).exec()
    } else {
      const node = canvasNodeRef.current
      if (node && typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect()
        canvasRectRef.current = {
          left: rect.left || 0,
          top: rect.top || 0,
          width: rect.width || 360,
          height: rect.height || 480
        }
      }
    }
  }, [])

  const [scaleDisplay, setScaleDisplay] = useState(100)
  const [isDragging, setIsDragging] = useState(false)
  const [internalShowColorCodes, setInternalShowColorCodes] = useState(false)

  const isShowColorCodesControlled = props.showColorCodes !== undefined
  const showColorCodes = isShowColorCodesControlled ? props.showColorCodes! : internalShowColorCodes

  const handleToggleColorCodes = useCallback(() => {
    const nextVal = !showColorCodes
    if (!isShowColorCodesControlled) {
      setInternalShowColorCodes(nextVal)
    }
    props.onToggleColorCodes?.(nextVal)
  }, [showColorCodes, isShowColorCodesControlled, props.onToggleColorCodes])

  const viewportRef = useRef<Viewport>({
    scale: 1.0,
    offsetX: 20,
    offsetY: 20
  })

  // 触控交互状态
  const touchStateRef = useRef({
    lastTouchDist: 0,
    isDragging: false,
    hasMovedSignificantly: false,
    dragStartScreen: { x: 0, y: 0 },
    dragStartOffset: { offsetX: 20, offsetY: 20 }
  })

  // 记录上一次的网格尺寸，避免每次单点笔触刷新时强制打断用户的平移缩放
  const lastGridDimRef = useRef({ w: 0, h: 0 })

  const getFitScale = useCallback(() => {
    if (!grid || grid.length === 0) return 1.0
    const gridH = grid.length
    const gridW = grid[0].length

    const boardW = gridW * baseCellSize
    const boardH = gridH * baseCellSize

    const w = canvasWidthRef.current || 360
    const h = canvasHeightRef.current || 480

    const rulerPadding = showRulers ? 20 : 0
    const paddingX = Math.min(32, w * 0.08) + rulerPadding
    const paddingY = Math.min(32, h * 0.08) + rulerPadding
    const availW = Math.max(80, w - paddingX * 2)
    const availH = Math.max(80, h - paddingY * 2)

    const scaleX = availW / boardW
    const scaleY = availH / boardH
    return clampScale(Math.min(scaleX, scaleY, 2.0), 0.2, 5.0)
  }, [grid, baseCellSize, showRulers])

  const centerAndFitBoard = useCallback(() => {
    if (!grid || grid.length === 0) return
    const gridH = grid.length
    const gridW = grid[0].length

    const boardW = gridW * baseCellSize
    const boardH = gridH * baseCellSize

    const w = canvasWidthRef.current || 360
    const h = canvasHeightRef.current || 480

    const initialScale = getFitScale()

    viewportRef.current.scale = initialScale
    // 精确将底板中点与画布中点重合 (Math.round 避免亚像素模糊)
    viewportRef.current.offsetX = Math.round((w - boardW * initialScale) / 2)
    viewportRef.current.offsetY = Math.round((h - boardH * initialScale) / 2)
    setScaleDisplay(Math.round(initialScale * 100))
  }, [grid, baseCellSize, getFitScale])

  const renderCanvas = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx || !grid || grid.length === 0) return

    const width = canvasWidthRef.current
    const height = canvasHeightRef.current
    ctx.clearRect(0, 0, width, height)

    const gridH = grid.length
    const gridW = grid[0].length
    const { scale, offsetX, offsetY } = viewportRef.current
    const scaledCell = baseCellSize * scale

    const isLight = theme === 'light'
    const boardBgColor = isLight ? '#ffffff' : '#22232a'
    const emptyCellBg = isLight ? '#f1f5f9' : '#1e1f26'
    const emptyCellBorder = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)'
    const cellBorderColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'
    const rulerLineColor = isLight ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.18)'

    // 1. 底板底色
    const boardW = gridW * scaledCell
    const boardH = gridH * scaledCell

    ctx.fillStyle = boardBgColor
    ctx.fillRect(offsetX, offsetY, boardW, boardH)

    // 2. 视锥剔除：计算当前屏幕可见单元格范围
    const minX = Math.max(0, Math.floor(-offsetX / scaledCell))
    const maxX = Math.min(gridW, Math.ceil((width - offsetX) / scaledCell))
    const minY = Math.max(0, Math.floor(-offsetY / scaledCell))
    const maxY = Math.min(gridH, Math.ceil((height - offsetY) / scaledCell))

    // 3. 循环绘制每个方块
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const cell = grid[y][x]
        const cellLeft = offsetX + x * scaledCell
        const cellTop = offsetY + y * scaledCell

        if (cell.isEmpty) {
          ctx.fillStyle = emptyCellBg
          ctx.fillRect(cellLeft, cellTop, scaledCell, scaledCell)
          ctx.strokeStyle = emptyCellBorder
          ctx.lineWidth = 0.5
          ctx.strokeRect(cellLeft, cellTop, scaledCell, scaledCell)
          continue
        }

        const isTarget = !selectedColorCode || cell.color.code === selectedColorCode

        // 寻豆模式暗化
        ctx.globalAlpha = isTarget ? 1.0 : (isLight ? 0.18 : 0.22)

        // 绘制方块主体
        ctx.fillStyle = cell.color.hex
        ctx.fillRect(cellLeft, cellTop, scaledCell, scaledCell)

        // 方块边界细线
        ctx.strokeStyle = cellBorderColor
        ctx.lineWidth = 0.5
        ctx.strokeRect(cellLeft, cellTop, scaledCell, scaledCell)

        // 目标色号专属高亮框
        if (selectedColorCode && cell.color.code === selectedColorCode) {
          ctx.globalAlpha = 1.0
          ctx.lineWidth = Math.max(2.0, 2.5 * scale)
          ctx.strokeStyle = '#FFE600'
          ctx.strokeRect(cellLeft, cellTop, scaledCell, scaledCell)
        }

        // 开启色号展示且尺寸足够阅读时绘制色号文本
        if (shouldShowColorCode(showColorCodes, scaledCell)) {
          ctx.globalAlpha = isTarget ? 1.0 : (isLight ? 0.25 : 0.3)
          const textColor = getContrastTextColor(cell.color.hex)
          const fontSize = computeColorCodeFontSize(scaledCell)
          ctx.fillStyle = textColor
          ctx.font = `bold ${fontSize}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(cell.color.code, cellLeft + scaledCell / 2, cellTop + scaledCell / 2)
        }
      }
    }

    ctx.globalAlpha = 1.0

    // 4. 网格每 5 格标尺线
    ctx.strokeStyle = rulerLineColor
    ctx.lineWidth = 1
    for (let x = 0; x <= gridW; x += 5) {
      const lineX = offsetX + x * scaledCell
      if (lineX >= 0 && lineX <= width) {
        ctx.beginPath()
        ctx.moveTo(lineX, offsetY)
        ctx.lineTo(lineX, offsetY + boardH)
        ctx.stroke()
      }
    }
    for (let y = 0; y <= gridH; y += 5) {
      const lineY = offsetY + y * scaledCell
      if (lineY >= 0 && lineY <= height) {
        ctx.beginPath()
        ctx.moveTo(offsetX, lineY)
        ctx.lineTo(offsetX + boardW, lineY)
        ctx.stroke()
      }
    }
    // 5. 绘制四周坐标刻度标尺 (当 showRulers 开启时)
    const rulerBand = getRulerBandSize(scaledCell, showRulers)
    if (showRulers && rulerBand > 0) {
      const rulerBg = isLight ? '#f1f5f9' : '#181920'
      const rulerBorder = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)'
      const rulerText = isLight ? '#64748b' : '#94a3b8'
      const rulerHighlightText = isLight ? '#0284c7' : '#38bdf8'
      const rulerTickColor = isLight ? '#94a3b8' : 'rgba(255, 255, 255, 0.2)'
      const fontSize = computeRulerFontSize(scaledCell)

      // 标尺带背景（顶部、底部、左侧、右侧及四角）
      ctx.fillStyle = rulerBg
      ctx.fillRect(offsetX - rulerBand, offsetY - rulerBand, boardW + rulerBand * 2, rulerBand)
      ctx.fillRect(offsetX - rulerBand, offsetY + boardH, boardW + rulerBand * 2, rulerBand)
      ctx.fillRect(offsetX - rulerBand, offsetY, rulerBand, boardH)
      ctx.fillRect(offsetX + boardW, offsetY, rulerBand, boardH)

      // 标尺带内外边框
      ctx.strokeStyle = rulerBorder
      ctx.lineWidth = 0.5
      ctx.strokeRect(offsetX - rulerBand, offsetY - rulerBand, boardW + rulerBand * 2, boardH + rulerBand * 2)
      ctx.strokeRect(offsetX, offsetY, boardW, boardH)

      ctx.font = `600 ${fontSize}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // 绘制列标尺 (顶部与底部)
      for (let x = 0; x < gridW; x++) {
        const colCenter = offsetX + x * scaledCell + scaledCell / 2
        if (colCenter + scaledCell < 0 || colCenter - scaledCell > width) continue

        const isTickSpecial = (x + 1) % 5 === 0 || x === 0 || x === gridW - 1
        const showText = shouldShowRulerTickNumber(x, gridW, scaledCell)

        if (showText) {
          ctx.fillStyle = isTickSpecial ? rulerHighlightText : rulerText
          ctx.fillText(String(x + 1), colCenter, offsetY - rulerBand / 2)
          ctx.fillText(String(x + 1), colCenter, offsetY + boardH + rulerBand / 2)
        }

        // 短刻度线
        ctx.strokeStyle = rulerTickColor
        ctx.lineWidth = isTickSpecial ? 1.0 : 0.5
        const tickLen = isTickSpecial ? 4 : 2
        // 顶部刻度
        ctx.beginPath()
        ctx.moveTo(offsetX + (x + 1) * scaledCell, offsetY - tickLen)
        ctx.lineTo(offsetX + (x + 1) * scaledCell, offsetY)
        ctx.stroke()
        // 底部刻度
        ctx.beginPath()
        ctx.moveTo(offsetX + (x + 1) * scaledCell, offsetY + boardH)
        ctx.lineTo(offsetX + (x + 1) * scaledCell, offsetY + boardH + tickLen)
        ctx.stroke()
      }

      // 绘制行标尺 (左侧与右侧)
      for (let y = 0; y < gridH; y++) {
        const rowCenter = offsetY + y * scaledCell + scaledCell / 2
        if (rowCenter + scaledCell < 0 || rowCenter - scaledCell > height) continue

        const isTickSpecial = (y + 1) % 5 === 0 || y === 0 || y === gridH - 1
        const showText = shouldShowRulerTickNumber(y, gridH, scaledCell)

        if (showText) {
          ctx.fillStyle = isTickSpecial ? rulerHighlightText : rulerText
          ctx.fillText(String(y + 1), offsetX - rulerBand / 2, rowCenter)
          ctx.fillText(String(y + 1), offsetX + boardW + rulerBand / 2, rowCenter)
        }

        // 短刻度线
        ctx.strokeStyle = rulerTickColor
        ctx.lineWidth = isTickSpecial ? 1.0 : 0.5
        const tickLen = isTickSpecial ? 4 : 2
        // 左侧刻度
        ctx.beginPath()
        ctx.moveTo(offsetX - tickLen, offsetY + (y + 1) * scaledCell)
        ctx.lineTo(offsetX, offsetY + (y + 1) * scaledCell)
        ctx.stroke()
        // 右侧刻度
        ctx.beginPath()
        ctx.moveTo(offsetX + boardW, offsetY + (y + 1) * scaledCell)
        ctx.lineTo(offsetX + boardW + tickLen, offsetY + (y + 1) * scaledCell)
        ctx.stroke()
      }
    }
  }, [grid, selectedColorCode, baseCellSize, theme, showColorCodes, showRulers])

  const zoomAtPoint = useCallback((screenX: number, screenY: number, factor: number) => {
    if (!grid || grid.length === 0) return
    const gridH = grid.length
    const gridW = grid[0].length
    const boardW = gridW * baseCellSize
    const boardH = gridH * baseCellSize
    const w = canvasWidthRef.current || 360
    const h = canvasHeightRef.current || 480

    const fitScale = getFitScale()
    const oldScale = viewportRef.current.scale
    // 最小缩放限制为自适应视口比例，避免无限缩小
    const newScale = clampScale(oldScale * factor, fitScale, 8.0)
    if (newScale === oldScale) return

    const ratio = newScale / oldScale
    const rawOffsetX = screenX - (screenX - viewportRef.current.offsetX) * ratio
    const rawOffsetY = screenY - (screenY - viewportRef.current.offsetY) * ratio

    const scaledCell = baseCellSize * newScale
    const rulerBand = getRulerBandSize(scaledCell, showRulers)
    const availW = Math.max(80, w - rulerBand * 2)
    const availH = Math.max(80, h - rulerBand * 2)

    const clamped = clampViewportBounds(
      { scale: newScale, offsetX: rawOffsetX - rulerBand, offsetY: rawOffsetY - rulerBand },
      availW,
      availH,
      boardW,
      boardH
    )

    viewportRef.current = {
      scale: newScale,
      offsetX: clamped.offsetX + rulerBand,
      offsetY: clamped.offsetY + rulerBand
    }
    setScaleDisplay(Math.round(clamped.scale * 100))
    renderCanvas()
  }, [grid, baseCellSize, showRulers, getFitScale, renderCanvas])

  const handleCellTap = useCallback((touchOrEvent: any) => {
    if (!grid || grid.length === 0) return
    const rel = getCanvasRelativeCoords(touchOrEvent, canvasRectRef.current)

    const pos = screenToGrid(
      rel.x,
      rel.y,
      viewportRef.current,
      baseCellSize,
      grid[0].length,
      grid.length
    )

    if (pos && onCellClick) {
      const cell = grid[pos.gridY][pos.gridX]
      onCellClick({ x: pos.gridX, y: pos.gridY, cell })
    }
  }, [grid, baseCellSize, onCellClick])

  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)

  const captureSnapshot = useCallback(() => {
    try {
      const node = canvasNodeRef.current
      if (node && typeof node.toDataURL === 'function') {
        const url = node.toDataURL('image/png')
        if (url) {
          setSnapshotUrl(url)
          return url
        }
      }
    } catch (err) {
      console.warn('Canvas snapshot capture failed', err)
    }
    return null
  }, [])

  useImperativeHandle(ref, () => ({
    render: renderCanvas,
    resetView: () => {
      centerAndFitBoard()
      renderCanvas()
    },
    getSnapshot: captureSnapshot
  }), [renderCanvas, centerAndFitBoard, captureSnapshot])

  useEffect(() => {
    if (props.isOverlayActive) {
      if (!snapshotUrl) {
        captureSnapshot()
      }
    } else {
      setSnapshotUrl(null)
      const timer = setTimeout(() => {
        renderCanvas()
      }, 30)
      return () => clearTimeout(timer)
    }
  }, [props.isOverlayActive, snapshotUrl, captureSnapshot, renderCanvas])

  // 初始化 Canvas
  useEffect(() => {
    const isWeApp = process.env.TARO_ENV === 'weapp'

    if (isWeApp) {
      let isMounted = true
      let retryCount = 0
      let timer: any = null

      const initWeappCanvas = () => {
        if (!isMounted) return
        const query = Taro.createSelectorQuery()
        query
          .select('#beadCanvas')
          .fields({ node: true, size: true })
          .exec((res: any) => {
            if (!isMounted) return
            if (!res || !res[0] || !res[0].node) {
              if (retryCount < 30) {
                retryCount++
                timer = setTimeout(initWeappCanvas, 60)
              }
              return
            }
            const node = res[0].node
            canvasNodeRef.current = node
            const ctx = node.getContext('2d')
            ctxRef.current = ctx
            const sys = Taro.getSystemInfoSync()
            const dpr = sys.pixelRatio || 1
            dprRef.current = dpr
            const w = res[0].width || 360
            const h = res[0].height || 480
            canvasWidthRef.current = w
            canvasHeightRef.current = h

            node.width = w * dpr
            node.height = h * dpr
            ctx.scale(dpr, dpr)

            updateCanvasRect()
            centerAndFitBoard()
            renderCanvas()
          })
      }

      initWeappCanvas()

      return () => {
        isMounted = false
        if (timer) clearTimeout(timer)
      }
    } else {
      // H5 / Browser 环境：响应式自适应容器与居中
      let resizeObserver: ResizeObserver | null = null
      let isMounted = true

      const setupCanvasSize = () => {
        if (!isMounted) return false
        const root = document.getElementById('beadCanvas')
        const el = (root?.querySelector('canvas') || root) as HTMLCanvasElement
        if (!el || typeof el.getContext !== 'function') return false

        canvasNodeRef.current = el
        const ctx = el.getContext('2d')
        ctxRef.current = ctx

        const container = document.getElementById('canvasContainer') || (root || el).parentElement
        const rect = container?.getBoundingClientRect()
        const w = Math.round(rect?.width || window.innerWidth || 360)
        const h = Math.round(rect?.height || (window.innerHeight - 150) || 480)

        if (w <= 0 || h <= 0) return false

        canvasWidthRef.current = w
        canvasHeightRef.current = h
        const dpr = window.devicePixelRatio || 1
        dprRef.current = dpr

        el.width = w * dpr
        el.height = h * dpr
        el.style.width = '100%'
        el.style.height = '100%'
        ctx?.setTransform(1, 0, 0, 1, 0, 0)
        ctx?.scale(dpr, dpr)

        updateCanvasRect()
        centerAndFitBoard()
        renderCanvas()
        return true
      }

      const timer = setTimeout(function tryMount() {
        if (!isMounted) return
        const success = setupCanvasSize()
        if (!success) {
          setTimeout(tryMount, 50)
          return
        }

        const container = document.getElementById('canvasContainer')
        if (typeof ResizeObserver !== 'undefined' && container) {
          resizeObserver = new ResizeObserver(() => {
            setupCanvasSize()
          })
          resizeObserver.observe(container)
        } else {
          window.addEventListener('resize', setupCanvasSize)
        }
      }, 50)

      return () => {
        isMounted = false
        clearTimeout(timer)
        if (resizeObserver) {
          resizeObserver.disconnect()
        } else {
          window.removeEventListener('resize', setupCanvasSize)
        }
      }
    }
  }, [centerAndFitBoard, renderCanvas])

  // 依赖变化重新渲染：网格规格变化时自动一键居中
  useEffect(() => {
    if (!grid || grid.length === 0) return
    const curW = grid[0].length
    const curH = grid.length
    if (lastGridDimRef.current.w !== curW || lastGridDimRef.current.h !== curH) {
      lastGridDimRef.current = { w: curW, h: curH }
      centerAndFitBoard()
    }
    renderCanvas()
  }, [grid, centerAndFitBoard, renderCanvas])

  useEffect(() => {
    renderCanvas()
  }, [selectedColorCode, theme, showColorCodes, showRulers, renderCanvas])

  const applyClampedDragOffset = useCallback((rawX: number, rawY: number) => {
    if (grid && grid.length > 0) {
      const scale = viewportRef.current.scale
      const scaledCell = baseCellSize * scale
      const rulerBand = getRulerBandSize(scaledCell, showRulers)
      const boardW = grid[0].length * baseCellSize
      const boardH = grid.length * baseCellSize
      const availW = Math.max(80, canvasWidthRef.current - rulerBand * 2)
      const availH = Math.max(80, canvasHeightRef.current - rulerBand * 2)
      const clamped = clampViewportBounds(
        { scale, offsetX: rawX - rulerBand, offsetY: rawY - rulerBand },
        availW,
        availH,
        boardW,
        boardH
      )
      viewportRef.current.offsetX = clamped.offsetX + rulerBand
      viewportRef.current.offsetY = clamped.offsetY + rulerBand
    } else {
      viewportRef.current.offsetX = rawX
      viewportRef.current.offsetY = rawY
    }
  }, [grid, baseCellSize, showRulers])

  // 触摸手势
  const handleTouchStart = (e: any) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation()
    updateCanvasRect()
    const touches = e.touches
    if (touches.length === 1) {
      touchStateRef.current.isDragging = true
      touchStateRef.current.hasMovedSignificantly = false
      touchStateRef.current.dragStartScreen = { x: touches[0].clientX, y: touches[0].clientY }
      touchStateRef.current.dragStartOffset = {
        offsetX: viewportRef.current.offsetX,
        offsetY: viewportRef.current.offsetY
      }
      setIsDragging(true)
    } else if (touches.length >= 2) {
      touchStateRef.current.isDragging = false
      setIsDragging(false)
      touchStateRef.current.lastTouchDist = calculateTouchDistance(touches[0], touches[1])
    }
  }

  const handleTouchMove = (e: any) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation()
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    const touches = e.touches
    if (touches.length === 1 && touchStateRef.current.isDragging) {
      const dx = touches[0].clientX - touchStateRef.current.dragStartScreen.x
      const dy = touches[0].clientY - touchStateRef.current.dragStartScreen.y
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        touchStateRef.current.hasMovedSignificantly = true
      }
      applyClampedDragOffset(
        touchStateRef.current.dragStartOffset.offsetX + dx,
        touchStateRef.current.dragStartOffset.offsetY + dy
      )
      renderCanvas()
    } else if (touches.length >= 2) {
      const dist = calculateTouchDistance(touches[0], touches[1])
      if (touchStateRef.current.lastTouchDist > 0) {
        const factor = dist / touchStateRef.current.lastTouchDist
        const center = calculateTouchCenter(touches[0], touches[1])
        zoomAtPoint(center.x, center.y, factor)
      }
      touchStateRef.current.lastTouchDist = dist
    }
  }

  const handleTouchEnd = (e: any) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation()
    if (
      touchStateRef.current.isDragging &&
      !touchStateRef.current.hasMovedSignificantly &&
      e.changedTouches &&
      e.changedTouches.length === 1
    ) {
      handleCellTap(e.changedTouches[0])
    }
    touchStateRef.current.isDragging = false
    touchStateRef.current.lastTouchDist = 0
    setIsDragging(false)
  }

  // 鼠标操作（Web / H5 调试）
  const handleMouseDown = (e: any) => {
    updateCanvasRect()
    if (e.button !== undefined && e.button !== 0) return
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    touchStateRef.current.isDragging = true
    touchStateRef.current.hasMovedSignificantly = false
    touchStateRef.current.dragStartScreen = { x: e.clientX, y: e.clientY }
    touchStateRef.current.dragStartOffset = {
      offsetX: viewportRef.current.offsetX,
      offsetY: viewportRef.current.offsetY
    }
    setIsDragging(true)
  }

  const handleMouseMove = (e: any) => {
    if (!touchStateRef.current.isDragging) return
    const dx = e.clientX - touchStateRef.current.dragStartScreen.x
    const dy = e.clientY - touchStateRef.current.dragStartScreen.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      touchStateRef.current.hasMovedSignificantly = true
    }
    applyClampedDragOffset(
      touchStateRef.current.dragStartOffset.offsetX + dx,
      touchStateRef.current.dragStartOffset.offsetY + dy
    )
    renderCanvas()
  }

  const handleMouseUp = (e: any) => {
    if (touchStateRef.current.isDragging && !touchStateRef.current.hasMovedSignificantly) {
      handleCellTap({ clientX: e.clientX, clientY: e.clientY })
    }
    touchStateRef.current.isDragging = false
    setIsDragging(false)
  }

  // Web 端支持全局鼠标拖拽监听，防止拖拽划出画布断掉
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') return

    const onGlobalMouseMove = (e: MouseEvent) => {
      if (!touchStateRef.current.isDragging) return
      const dx = e.clientX - touchStateRef.current.dragStartScreen.x
      const dy = e.clientY - touchStateRef.current.dragStartScreen.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        touchStateRef.current.hasMovedSignificantly = true
      }
      applyClampedDragOffset(
        touchStateRef.current.dragStartOffset.offsetX + dx,
        touchStateRef.current.dragStartOffset.offsetY + dy
      )
      renderCanvas()
    }

    const onGlobalMouseUp = (e: MouseEvent) => {
      if (touchStateRef.current.isDragging) {
        if (!touchStateRef.current.hasMovedSignificantly) {
          handleCellTap(e.clientX, e.clientY)
        }
        touchStateRef.current.isDragging = false
        setIsDragging(false)
      }
    }

    window.addEventListener('mousemove', onGlobalMouseMove)
    window.addEventListener('mouseup', onGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove)
      window.removeEventListener('mouseup', onGlobalMouseUp)
    }
  }, [renderCanvas, handleCellTap, applyClampedDragOffset])

  const handleWheel = (e: any) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    const factor = e.deltaY < 0 ? 1.15 : 0.88
    const node = canvasNodeRef.current
    const rect = node && typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null
    const clientX = rect ? e.clientX - rect.left : canvasWidthRef.current / 2
    const clientY = rect ? e.clientY - rect.top : canvasHeightRef.current / 2
    zoomAtPoint(clientX, clientY, factor)
  }

  return (
    <View
      className={`canvas-container tool-${tool} theme-${theme} ${isDragging ? 'is-dragging' : ''}`}
      id="canvasContainer"
      catchMove={true}
    >
      {/* 当弹窗打开时，展示纯静态 Image 替代原生 Canvas，彻底避免原生 Canvas 2D 在微信各机型上的同层/非同层穿透遮挡 */}
      {props.isOverlayActive && snapshotUrl && (
        <Image
          src={snapshotUrl}
          className="bead-canvas-snapshot"
          mode="scaleToFill"
        />
      )}

      <Canvas
        id="beadCanvas"
        canvasId="beadCanvas"
        type="2d"
        className="bead-canvas"
        disableScroll={true}
        catchMove={true}
        style={props.isOverlayActive ? { display: 'none', visibility: 'hidden', opacity: 0 } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        // @ts-ignore
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />
    </View>
  )
})
