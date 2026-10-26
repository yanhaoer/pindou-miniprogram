<template>
  <view class="canvas-container" id="canvasContainer">
    <canvas
      id="beadCanvas"
      canvas-id="beadCanvas"
      type="2d"
      class="bead-canvas"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @wheel.prevent="handleWheel"
    ></canvas>

    <!-- 浮动缩放控制条 -->
    <view class="zoom-controls">
      <view class="zoom-btn" @tap="zoomIn">+</view>
      <view class="zoom-text">{{ Math.round(viewport.scale * 100) }}%</view>
      <view class="zoom-btn" @tap="zoomOut">-</view>
      <view class="zoom-btn reset-btn" @tap="resetView">复位</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, getCurrentInstance } from 'vue'
import type { BeadCell } from '@/utils/quantizer'
import type { BeadColor } from '@/palettes/types'
import {
  clampScale,
  screenToGrid,
  calculateTouchDistance,
  calculateTouchCenter,
  type Viewport
} from '@/utils/gesture'

const props = withDefaults(
  defineProps<{
    grid: BeadCell[][]
    selectedColorCode?: string | null
    tool?: 'view' | 'pencil' | 'eyedropper' | 'bucket' | 'eraser'
    activeColor?: BeadColor | null
    baseCellSize?: number
  }>(),
  {
    selectedColorCode: null,
    tool: 'view',
    activeColor: null,
    baseCellSize: 22
  }
)

const emit = defineEmits<{
  (e: 'cell-click', payload: { x: number; y: number; cell: BeadCell }): void
  (e: 'pick-color', color: BeadColor): void
}>()

const instance = getCurrentInstance()
let canvas: any = null
let ctx: any = null
const canvasWidth = ref(360)
const canvasHeight = ref(480)
const dpr = ref(1)

const viewport = ref<Viewport>({
  scale: 1.0,
  offsetX: 20,
  offsetY: 20
})

// 触控交互状态
let lastTouchDist = 0
let lastTouchCenter = { x: 0, y: 0 }
let isDragging = false
let dragStartScreen = { x: 0, y: 0 }
let dragStartOffset = { x: 0, y: 0 }
let hasMovedSignificantly = false

function initCanvas() {
  // #ifdef MP-WEIXIN
  const query = uni.createSelectorQuery().in(instance)
  query
    .select('#beadCanvas')
    .fields({ node: true, size: true })
    .exec((res: any) => {
      if (!res || !res[0] || !res[0].node) return
      canvas = res[0].node
      ctx = canvas.getContext('2d')
      const sys = uni.getSystemInfoSync()
      dpr.value = sys.pixelRatio || 1
      canvasWidth.value = res[0].width
      canvasHeight.value = res[0].height

      canvas.width = res[0].width * dpr.value
      canvas.height = res[0].height * dpr.value
      ctx.scale(dpr.value, dpr.value)

      centerAndFitBoard()
      render()
    })
  // #endif

  // #ifndef MP-WEIXIN
  // H5 / Web 环境
  nextTick(() => {
    const el = document.getElementById('beadCanvas') as HTMLCanvasElement
    if (!el) return
    canvas = el
    ctx = el.getContext('2d')
    const rect = el.parentElement?.getBoundingClientRect()
    const w = rect?.width || 360
    const h = rect?.height || 480
    canvasWidth.value = w
    canvasHeight.value = h
    dpr.value = window.devicePixelRatio || 1

    el.width = w * dpr.value
    el.height = h * dpr.value
    el.style.width = `${w}px`
    el.style.height = `${h}px`
    ctx.scale(dpr.value, dpr.value)

    centerAndFitBoard()
    render()
  })
  // #endif
}

function centerAndFitBoard() {
  if (!props.grid || props.grid.length === 0) return
  const gridH = props.grid.length
  const gridW = props.grid[0].length

  const boardW = gridW * props.baseCellSize
  const boardH = gridH * props.baseCellSize

  const scaleX = (canvasWidth.value - 40) / boardW
  const scaleY = (canvasHeight.value - 60) / boardH
  const initialScale = clampScale(Math.min(scaleX, scaleY, 1.2), 0.5, 3.0)

  viewport.value.scale = initialScale
  viewport.value.offsetX = (canvasWidth.value - boardW * initialScale) / 2
  viewport.value.offsetY = (canvasHeight.value - boardH * initialScale) / 2
}

/**
 * 核心高性能渲染函数
 */
function render() {
  if (!ctx || !props.grid || props.grid.length === 0) return

  const width = canvasWidth.value
  const height = canvasHeight.value
  ctx.clearRect(0, 0, width, height)

  const gridH = props.grid.length
  const gridW = props.grid[0].length
  const { scale, offsetX, offsetY } = viewport.value
  const scaledCell = props.baseCellSize * scale
  const beadRadius = (scaledCell * 0.9) / 2
  const holeRadius = beadRadius * 0.38

  // 1. 绘制底板底色与外阴影
  const boardW = gridW * scaledCell
  const boardH = gridH * scaledCell

  ctx.fillStyle = '#22232a'
  ctx.fillRect(offsetX, offsetY, boardW, boardH)

  // 2. 视锥剔除：计算当前屏幕可见单元格范围
  const minX = Math.max(0, Math.floor(-offsetX / scaledCell))
  const maxX = Math.min(gridW, Math.ceil((width - offsetX) / scaledCell))
  const minY = Math.max(0, Math.floor(-offsetY / scaledCell))
  const maxY = Math.min(gridH, Math.ceil((height - offsetY) / scaledCell))

  const selectedCode = props.selectedColorCode

  // 3. 循环绘制每个珠子
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const cell = props.grid[y][x]
      const cellLeft = offsetX + x * scaledCell
      const cellTop = offsetY + y * scaledCell
      const centerX = cellLeft + scaledCell / 2
      const centerY = cellTop + scaledCell / 2

      if (cell.isEmpty) {
        // 空插针
        ctx.fillStyle = '#2d2e36'
        ctx.beginPath()
        ctx.arc(centerX, centerY, Math.max(1.5, holeRadius * 0.8), 0, Math.PI * 2)
        ctx.fill()
        continue
      }

      const isTarget = !selectedCode || cell.color.code === selectedCode

      // 寻豆模式：非目标豆暗化
      ctx.globalAlpha = isTarget ? 1.0 : 0.22

      // 外圈珠体
      ctx.fillStyle = cell.color.hex
      ctx.beginPath()
      ctx.arc(centerX, centerY, beadRadius, 0, Math.PI * 2)
      ctx.fill()

      // 立体光影描边
      ctx.lineWidth = Math.max(0.8, 1.2 * scale)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.stroke()

      // 中心插孔
      ctx.fillStyle = '#18191f'
      ctx.beginPath()
      ctx.arc(centerX, centerY, holeRadius, 0, Math.PI * 2)
      ctx.fill()

      // 目标色号专属高亮发光环
      if (selectedCode && cell.color.code === selectedCode) {
        ctx.globalAlpha = 1.0
        ctx.lineWidth = Math.max(2.0, 2.8 * scale)
        ctx.strokeStyle = '#FFE600'
        ctx.beginPath()
        ctx.arc(centerX, centerY, beadRadius + 1.5, 0, Math.PI * 2)
        ctx.stroke()
      }

      // 放大到一定程度展示色号字符（方便实物对照拼装）
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

  // 4. 绘制网格每 5 格与 10 格粗标尺分割线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
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
}

function getContrastTextColor(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.5 ? '#111111' : '#FFFFFF'
}

// 手势处理
function handleTouchStart(e: any) {
  const touches = e.touches
  if (touches.length === 1) {
    isDragging = true
    hasMovedSignificantly = false
    dragStartScreen = { x: touches[0].clientX, y: touches[0].clientY }
    dragStartOffset = { ...viewport.value }
  } else if (touches.length >= 2) {
    isDragging = false
    lastTouchDist = calculateTouchDistance(touches[0], touches[1])
    lastTouchCenter = calculateTouchCenter(touches[0], touches[1])
  }
}

function handleTouchMove(e: any) {
  const touches = e.touches
  if (touches.length === 1 && isDragging) {
    const dx = touches[0].clientX - dragStartScreen.x
    const dy = touches[0].clientY - dragStartScreen.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedSignificantly = true
    }
    viewport.value.offsetX = dragStartOffset.x + dx
    viewport.value.offsetY = dragStartOffset.y + dy
    render()
  } else if (touches.length >= 2) {
    const dist = calculateTouchDistance(touches[0], touches[1])
    if (lastTouchDist > 0) {
      const zoomFactor = dist / lastTouchDist
      const center = calculateTouchCenter(touches[0], touches[1])
      zoomAtPoint(center.x, center.y, zoomFactor)
    }
    lastTouchDist = dist
  }
}

function handleTouchEnd(e: any) {
  if (isDragging && !hasMovedSignificantly && e.changedTouches && e.changedTouches.length === 1) {
    handleCellTap(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
  }
  isDragging = false
  lastTouchDist = 0
}

// 桌面端鼠标交互（供 H5 调试）
function handleMouseDown(e: MouseEvent) {
  isDragging = true
  hasMovedSignificantly = false
  dragStartScreen = { x: e.clientX, y: e.clientY }
  dragStartOffset = { ...viewport.value }
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging) return
  const dx = e.clientX - dragStartScreen.x
  const dy = e.clientY - dragStartScreen.y
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    hasMovedSignificantly = true
  }
  viewport.value.offsetX = dragStartOffset.x + dx
  viewport.value.offsetY = dragStartOffset.y + dy
  render()
}

function handleMouseUp(e: MouseEvent) {
  if (isDragging && !hasMovedSignificantly) {
    handleCellTap(e.clientX, e.clientY)
  }
  isDragging = false
}

function handleWheel(e: WheelEvent) {
  const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88
  zoomAtPoint(e.clientX, e.clientY, zoomFactor)
}

function zoomAtPoint(screenX: number, screenY: number, factor: number) {
  const oldScale = viewport.value.scale
  const newScale = clampScale(oldScale * factor, 0.5, 10.0)
  if (newScale === oldScale) return

  // 保持屏幕触点下对应的底板物理位置不变
  const ratio = newScale / oldScale
  viewport.value.offsetX = screenX - (screenX - viewport.value.offsetX) * ratio
  viewport.value.offsetY = screenY - (screenY - viewport.value.offsetY) * ratio
  viewport.value.scale = newScale
  render()
}

function handleCellTap(clientX: number, clientY: number) {
  if (!canvas || !props.grid || props.grid.length === 0) return
  const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 }
  const canvasX = clientX - rect.left
  const canvasY = clientY - rect.top

  const pos = screenToGrid(
    canvasX,
    canvasY,
    viewport.value,
    props.baseCellSize,
    props.grid[0].length,
    props.grid.length
  )

  if (pos) {
    const cell = props.grid[pos.gridY][pos.gridX]
    emit('cell-click', { x: pos.gridX, y: pos.gridY, cell })
  }
}

function zoomIn() {
  zoomAtPoint(canvasWidth.value / 2, canvasHeight.value / 2, 1.25)
}

function zoomOut() {
  zoomAtPoint(canvasWidth.value / 2, canvasHeight.value / 2, 0.8)
}

function resetView() {
  centerAndFitBoard()
  render()
}

watch(
  () => [props.grid, props.selectedColorCode],
  () => {
    nextTick(() => render())
  },
  { deep: true }
)

onMounted(() => {
  initCanvas()
})

defineExpose({
  render,
  resetView
})
</script>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #121316;
  touch-action: none;
}

.bead-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.zoom-controls {
  position: absolute;
  right: 16px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(30, 32, 40, 0.85);
  backdrop-filter: blur(8px);
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 10;
}

.zoom-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f1f2f6;
  font-size: 18px;
  font-weight: bold;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
}

.zoom-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

.zoom-text {
  font-size: 11px;
  color: #a4a7b5;
  text-align: center;
  font-family: monospace;
}

.reset-btn {
  font-size: 11px;
  color: #38bdf8;
}
</style>
