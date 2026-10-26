import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback
} from 'react'
import { View, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { BeadCell } from '@/utils/quantizer'
import type { BeadColor } from '@/palettes/types'
import {
  clampScale,
  screenToGrid,
  calculateTouchDistance,
  calculateTouchCenter,
  type Viewport
} from '@/utils/gesture'
import './BeadCanvas.scss'

export interface BeadCanvasRef {
  render: () => void
  resetView: () => void
}

export interface BeadCanvasProps {
  grid: BeadCell[][]
  selectedColorCode?: string | null
  tool?: 'view' | 'pencil' | 'eyedropper' | 'bucket' | 'eraser'
  activeColor?: BeadColor | null
  baseCellSize?: number
  theme?: 'dark' | 'light'
  onCellClick?: (payload: { x: number; y: number; cell: BeadCell }) => void
  onPickColor?: (color: BeadColor) => void
}

function getContrastTextColor(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.5 ? '#111111' : '#FFFFFF'
}

export const BeadCanvas = forwardRef<BeadCanvasRef, BeadCanvasProps>((props, ref) => {
  const {
    grid,
    selectedColorCode = null,
    tool = 'view',
    baseCellSize = 22,
    theme = 'dark',
    onCellClick,
    onPickColor
  } = props

  const canvasNodeRef = useRef<any>(null)
  const ctxRef = useRef<any>(null)
  const canvasWidthRef = useRef(360)
  const canvasHeightRef = useRef(480)
  const dprRef = useRef(1)

  const [scaleDisplay, setScaleDisplay] = useState(100)
  const [isDragging, setIsDragging] = useState(false)

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

  const centerAndFitBoard = useCallback(() => {
    if (!grid || grid.length === 0) return
    const gridH = grid.length
    const gridW = grid[0].length

    const boardW = gridW * baseCellSize
    const boardH = gridH * baseCellSize

    const w = canvasWidthRef.current || 360
    const h = canvasHeightRef.current || 480

    const paddingX = Math.min(32, w * 0.08)
    const paddingY = Math.min(32, h * 0.08)
    const availW = Math.max(80, w - paddingX * 2)
    const availH = Math.max(80, h - paddingY * 2)

    const scaleX = availW / boardW
    const scaleY = availH / boardH
    const initialScale = clampScale(Math.min(scaleX, scaleY, 2.0), 0.4, 5.0)

    viewportRef.current.scale = initialScale
    // 精确将底板中点与画布中点重合 (Math.round 避免亚像素模糊)
    viewportRef.current.offsetX = Math.round((w - boardW * initialScale) / 2)
    viewportRef.current.offsetY = Math.round((h - boardH * initialScale) / 2)
    setScaleDisplay(Math.round(initialScale * 100))
  }, [grid, baseCellSize])

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
    const beadRadius = (scaledCell * 0.9) / 2
    const holeRadius = beadRadius * 0.38

    const isLight = theme === 'light'
    const boardBgColor = isLight ? '#ffffff' : '#22232a'
    const emptyHoleBg = isLight ? '#e2e8f0' : '#2d2e36'
    const holeCenterBg = isLight ? '#cbd5e1' : '#18191f'
    const rulerLineColor = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)'
    const beadStrokeColor = isLight ? 'rgba(0, 0, 0, 0.18)' : 'rgba(0, 0, 0, 0.3)'

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

    // 3. 循环绘制每个珠子
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const cell = grid[y][x]
        const cellLeft = offsetX + x * scaledCell
        const cellTop = offsetY + y * scaledCell
        const centerX = cellLeft + scaledCell / 2
        const centerY = cellTop + scaledCell / 2

        if (cell.isEmpty) {
          ctx.fillStyle = emptyHoleBg
          ctx.beginPath()
          ctx.arc(centerX, centerY, Math.max(1.5, holeRadius * 0.8), 0, Math.PI * 2)
          ctx.fill()
          continue
        }

        const isTarget = !selectedColorCode || cell.color.code === selectedColorCode

        // 寻豆模式暗化
        ctx.globalAlpha = isTarget ? 1.0 : (isLight ? 0.16 : 0.22)

        // 外圈珠体
        ctx.fillStyle = cell.color.hex
        ctx.beginPath()
        ctx.arc(centerX, centerY, beadRadius, 0, Math.PI * 2)
        ctx.fill()

        // 描边
        ctx.lineWidth = Math.max(0.8, 1.2 * scale)
        ctx.strokeStyle = beadStrokeColor
        ctx.stroke()

        // 中心插孔
        ctx.fillStyle = holeCenterBg
        ctx.beginPath()
        ctx.arc(centerX, centerY, holeRadius, 0, Math.PI * 2)
        ctx.fill()

        // 目标色号专属高亮发光环
        if (selectedColorCode && cell.color.code === selectedColorCode) {
          ctx.globalAlpha = 1.0
          ctx.lineWidth = Math.max(2.0, 2.8 * scale)
          ctx.strokeStyle = '#FFE600'
          ctx.beginPath()
          ctx.arc(centerX, centerY, beadRadius + 1.5, 0, Math.PI * 2)
          ctx.stroke()
        }

        // 放大时展示色号字符
        if (scale >= 2.2 && isTarget) {
          ctx.globalAlpha = 0.95
          ctx.fillStyle = getContrastTextColor(cell.color.hex)
          ctx.font = `bold ${Math.max(8, Math.floor(scale * 4.5))}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(cell.color.code, centerX, centerY)
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
  }, [grid, selectedColorCode, baseCellSize, theme])

  const zoomAtPoint = useCallback((screenX: number, screenY: number, factor: number) => {
    const oldScale = viewportRef.current.scale
    const newScale = clampScale(oldScale * factor, 0.5, 10.0)
    if (newScale === oldScale) return

    const ratio = newScale / oldScale
    viewportRef.current.offsetX = screenX - (screenX - viewportRef.current.offsetX) * ratio
    viewportRef.current.offsetY = screenY - (screenY - viewportRef.current.offsetY) * ratio
    viewportRef.current.scale = newScale
    setScaleDisplay(Math.round(newScale * 100))
    renderCanvas()
  }, [renderCanvas])

  const handleCellTap = useCallback((clientX: number, clientY: number) => {
    if (!canvasNodeRef.current || !grid || grid.length === 0) return
    const canvasEl = canvasNodeRef.current
    const rect = canvasEl.getBoundingClientRect ? canvasEl.getBoundingClientRect() : { left: 0, top: 0 }
    const canvasX = clientX - rect.left
    const canvasY = clientY - rect.top

    const pos = screenToGrid(
      canvasX,
      canvasY,
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

  useImperativeHandle(ref, () => ({
    render: renderCanvas,
    resetView: () => {
      centerAndFitBoard()
      renderCanvas()
    }
  }), [renderCanvas, centerAndFitBoard])

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
  }, [selectedColorCode, theme, renderCanvas])

  // 触摸手势
  const handleTouchStart = (e: any) => {
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
    const touches = e.touches
    if (touches.length === 1 && touchStateRef.current.isDragging) {
      const dx = touches[0].clientX - touchStateRef.current.dragStartScreen.x
      const dy = touches[0].clientY - touchStateRef.current.dragStartScreen.y
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        touchStateRef.current.hasMovedSignificantly = true
      }
      viewportRef.current.offsetX = touchStateRef.current.dragStartOffset.offsetX + dx
      viewportRef.current.offsetY = touchStateRef.current.dragStartOffset.offsetY + dy
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
    if (
      touchStateRef.current.isDragging &&
      !touchStateRef.current.hasMovedSignificantly &&
      e.changedTouches &&
      e.changedTouches.length === 1
    ) {
      handleCellTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
    }
    touchStateRef.current.isDragging = false
    touchStateRef.current.lastTouchDist = 0
    setIsDragging(false)
  }

  // 鼠标操作（Web / H5 调试）
  const handleMouseDown = (e: any) => {
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
    viewportRef.current.offsetX = touchStateRef.current.dragStartOffset.offsetX + dx
    viewportRef.current.offsetY = touchStateRef.current.dragStartOffset.offsetY + dy
    renderCanvas()
  }

  const handleMouseUp = (e: any) => {
    if (touchStateRef.current.isDragging && !touchStateRef.current.hasMovedSignificantly) {
      handleCellTap(e.clientX, e.clientY)
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
      viewportRef.current.offsetX = touchStateRef.current.dragStartOffset.offsetX + dx
      viewportRef.current.offsetY = touchStateRef.current.dragStartOffset.offsetY + dy
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
  }, [renderCanvas, handleCellTap])

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
    >
      <Canvas
        id="beadCanvas"
        canvasId="beadCanvas"
        type="2d"
        className="bead-canvas"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        // @ts-ignore
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      <View className="zoom-controls">
        <View
          className="zoom-btn"
          onClick={() => zoomAtPoint(canvasWidthRef.current / 2, canvasHeightRef.current / 2, 1.25)}
          title="放大"
        >
          +
        </View>
        <View className="zoom-text">{scaleDisplay}%</View>
        <View
          className="zoom-btn"
          onClick={() => zoomAtPoint(canvasWidthRef.current / 2, canvasHeightRef.current / 2, 0.8)}
          title="缩小"
        >
          -
        </View>
        <View
          className="zoom-btn reset-btn"
          onClick={() => {
            centerAndFitBoard()
            renderCanvas()
          }}
          title="始终居中对齐"
        >
          居中
        </View>
      </View>
    </View>
  )
})
