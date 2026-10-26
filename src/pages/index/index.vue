<template>
  <view class="app-container">
    <!-- 顶部状态与主操作栏 -->
    <view class="top-nav">
      <view class="brand-title">
        <text class="app-icon">🎨</text>
        <view class="title-meta">
          <text class="main-title">拼豆生成器</text>
          <text class="sub-title">{{ currentPalette.name }} · {{ boardWidth }}×{{ boardHeight }}</text>
        </view>
      </view>

      <view class="nav-actions">
        <!-- 样图选择器 -->
        <view class="nav-btn secondary" @tap="showSamplePicker = true">
          <text>样例</text>
        </view>
        <!-- 上传/拍照 -->
        <view class="nav-btn secondary" @tap="handlePickImage">
          <text>选图</text>
        </view>
        <!-- 导出施工图纸 -->
        <view class="nav-btn primary" @tap="handleExportSheet">
          <text>导出图纸</text>
        </view>
      </view>
    </view>

    <!-- 微调工具栏 (平移/画笔/油漆桶/吸管/橡皮/撤销/重做/设置) -->
    <ToolBar
      v-model:currentTool="currentTool"
      :canUndo="history.canUndo"
      :canRedo="history.canRedo"
      @undo="handleUndo"
      @redo="handleRedo"
      @open-config="showConfigModal = true"
    />

    <!-- 中间主视图画布 -->
    <view class="canvas-viewport">
      <BeadCanvas
        ref="canvasRef"
        :grid="grid"
        :selectedColorCode="selectedColorCode"
        :tool="currentTool"
        :activeColor="activeColor"
        @cell-click="handleCellClick"
      />
    </view>

    <!-- 底部色号清单与寻豆面板 -->
    <ColorPaletteBar
      :stats="colorStats"
      v-model:selectedColorCode="selectedColorCode"
      v-model:activeColor="activeColor"
    />

    <!-- 参数配置弹窗 -->
    <ConfigModal
      v-model:visible="showConfigModal"
      :brand="currentBrand"
      :width="boardWidth"
      :height="boardHeight"
      :dither="useDither"
      @apply="handleApplyConfig"
    />

    <!-- 样图选择弹层 -->
    <view v-if="showSamplePicker" class="picker-overlay" @tap.self="showSamplePicker = false">
      <view class="picker-modal">
        <view class="picker-header">
          <text class="picker-title">选择内置经典像素样例</text>
          <view class="close-btn" @tap="showSamplePicker = false">✕</view>
        </view>
        <view class="sample-grid">
          <view
            v-for="sample in SAMPLES"
            :key="sample.id"
            class="sample-card"
            @tap="loadSample(sample)"
          >
            <text class="sample-icon">👾</text>
            <text class="sample-name">{{ sample.name }}</text>
            <text class="sample-desc">{{ sample.description }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 用于导出的离屏 Canvas (微信小程序 2D Canvas) -->
    <view class="offscreen-wrapper">
      <canvas id="exportCanvas" canvas-id="exportCanvas" type="2d" class="export-canvas"></canvas>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, getCurrentInstance } from 'vue'
import BeadCanvas from '@/components/BeadCanvas.vue'
import ToolBar, { type EditTool } from '@/components/ToolBar.vue'
import ColorPaletteBar from '@/components/ColorPaletteBar.vue'
import ConfigModal from '@/components/ConfigModal.vue'
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

const instance = getCurrentInstance()

// 状态参数
const currentBrand = ref<BeadBrand>('artkal')
const boardWidth = ref(29)
const boardHeight = ref(29)
const useDither = ref(false)

const currentTool = ref<EditTool>('view')
const selectedColorCode = ref<string | null>(null)
const activeColor = ref<BeadColor | null>(null)

const showConfigModal = ref(false)
const showSamplePicker = ref(false)

const grid = ref<BeadCell[][]>([])
const colorStats = ref<Map<string, BeadColorStatItem>>(new Map())
const history = ref(new HistoryManager(20))
const canvasRef = ref<any>(null)

// 缓存当前正在处理的原图像素数据
let rawImagePixels: Uint8ClampedArray | null = null
let rawImageWidth = 0
let rawImageHeight = 0

const currentPalette = computed(() => getPalette(currentBrand.value))

function refreshQuantizedGrid() {
  if (!rawImagePixels) return
  uni.showLoading({ title: '色彩量化匹配中...' })

  setTimeout(() => {
    try {
      const result = quantizeImageData(rawImagePixels!, rawImageWidth, rawImageHeight, {
        width: boardWidth.value,
        height: boardHeight.value,
        dither: useDither.value,
        palette: currentPalette.value
      })
      grid.value = result
      colorStats.value = getBeadColorStats(result)
      history.value.clear()
      history.value.pushState(result)

      // 默认选中数量最多的色号作为活动画笔色
      const sortedStats = Array.from(colorStats.value.values()).sort((a, b) => b.count - a.count)
      if (sortedStats.length > 0) {
        activeColor.value = sortedStats[0].color
      }

      if (canvasRef.value) {
        canvasRef.value.resetView()
      }
    } finally {
      uni.hideLoading()
    }
  }, 50)
}

function loadSample(sample: SamplePattern) {
  const imgData = sampleToImageData(sample)
  rawImagePixels = imgData.pixels
  rawImageWidth = imgData.width
  rawImageHeight = imgData.height
  boardWidth.value = sample.width
  boardHeight.value = sample.height
  showSamplePicker.value = false
  refreshQuantizedGrid()
}

function handlePickImage() {
  // #ifdef MP-WEIXIN
  uni.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const tempPath = res.tempFiles[0].tempFilePath
      decodeImageToPixels(tempPath)
    }
  })
  // #endif

  // #ifndef MP-WEIXIN
  // H5 选图
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (re) => {
      decodeImageToPixels(re.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
  input.click()
  // #endif
}

function decodeImageToPixels(imageSource: string) {
  uni.showLoading({ title: '加载图片中...' })

  // #ifndef MP-WEIXIN
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const offCanvas = document.createElement('canvas')
    offCanvas.width = img.width
    offCanvas.height = img.height
    const offCtx = offCanvas.getContext('2d')
    if (!offCtx) return
    offCtx.drawImage(img, 0, 0)
    const imgData = offCtx.getImageData(0, 0, img.width, img.height)
    rawImagePixels = imgData.data
    rawImageWidth = img.width
    rawImageHeight = img.height
    uni.hideLoading()
    refreshQuantizedGrid()
  }
  img.src = imageSource
  // #endif

  // #ifdef MP-WEIXIN
  const query = uni.createSelectorQuery().in(instance)
  query
    .select('#exportCanvas')
    .fields({ node: true, size: true })
    .exec((res: any) => {
      if (!res || !res[0] || !res[0].node) {
        uni.hideLoading()
        return
      }
      const expCanvas = res[0].node
      const expCtx = expCanvas.getContext('2d')
      const img = expCanvas.createImage()
      img.onload = () => {
        expCanvas.width = img.width
        expCanvas.height = img.height
        expCtx.drawImage(img, 0, 0)
        const imgData = expCtx.getImageData(0, 0, img.width, img.height)
        rawImagePixels = imgData.data
        rawImageWidth = img.width
        rawImageHeight = img.height
        uni.hideLoading()
        refreshQuantizedGrid()
      }
      img.src = imageSource
    })
  // #endif
}

function handleCellClick({ x, y, cell }: { x: number; y: number; cell: BeadCell }) {
  if (currentTool.value === 'view') {
    // 浏览模式下点击珠子：如果非空则激活寻豆高亮
    if (!cell.isEmpty) {
      if (selectedColorCode.value === cell.color.code) {
        selectedColorCode.value = null
      } else {
        selectedColorCode.value = cell.color.code
        activeColor.value = cell.color
      }
    }
    return
  }

  if (currentTool.value === 'eyedropper') {
    // 吸管工具：吸取当前豆子颜色
    if (!cell.isEmpty) {
      activeColor.value = cell.color
      selectedColorCode.value = cell.color.code
      uni.showToast({ title: `已吸取 ${cell.color.code}`, icon: 'none' })
      currentTool.value = 'pencil'
    }
    return
  }

  if (currentTool.value === 'pencil') {
    // 画笔涂色
    if (!activeColor.value) return
    grid.value[y][x].color = { ...activeColor.value }
    grid.value[y][x].isEmpty = false
    colorStats.value = getBeadColorStats(grid.value)
    history.value.pushState(grid.value)
    return
  }

  if (currentTool.value === 'eraser') {
    // 橡皮擦
    grid.value[y][x].isEmpty = true
    colorStats.value = getBeadColorStats(grid.value)
    history.value.pushState(grid.value)
    return
  }

  if (currentTool.value === 'bucket') {
    // 油漆桶填色
    if (!activeColor.value) return
    const affected = floodFill(grid.value, x, y, activeColor.value)
    if (affected > 0) {
      colorStats.value = getBeadColorStats(grid.value)
      history.value.pushState(grid.value)
    }
  }
}

function handleUndo() {
  const prev = history.value.undo()
  if (prev) {
    grid.value = prev
    colorStats.value = getBeadColorStats(prev)
  }
}

function handleRedo() {
  const next = history.value.redo()
  if (next) {
    grid.value = next
    colorStats.value = getBeadColorStats(next)
  }
}

function handleApplyConfig(payload: {
  brand: BeadBrand
  width: number
  height: number
  dither: boolean
}) {
  currentBrand.value = payload.brand
  boardWidth.value = payload.width
  boardHeight.value = payload.height
  useDither.value = payload.dither
  refreshQuantizedGrid()
}

async function handleExportSheet() {
  if (!grid.value || grid.value.length === 0) {
    uni.showToast({ title: '暂无图纸数据', icon: 'none' })
    return
  }

  uni.showLoading({ title: '正在渲染高清图纸...' })

  const dims = calculateSheetDimensions(
    grid.value[0].length,
    grid.value.length,
    colorStats.value.size,
    { cellSize: 26, rulerSize: 40, headerHeight: 90, margin: 30 }
  )

  // #ifndef MP-WEIXIN
  const offCanvas = document.createElement('canvas')
  offCanvas.width = dims.width
  offCanvas.height = dims.height
  const offCtx = offCanvas.getContext('2d')
  renderCraftSheet(offCtx, grid.value, currentPalette.value.name, colorStats.value, dims)
  const dataUrl = offCanvas.toDataURL('image/png')
  uni.hideLoading()
  saveSheetImage(dataUrl)
  // #endif

  // #ifdef MP-WEIXIN
  const query = uni.createSelectorQuery().in(instance)
  query
    .select('#exportCanvas')
    .fields({ node: true, size: true })
    .exec((res: any) => {
      if (!res || !res[0] || !res[0].node) {
        uni.hideLoading()
        return
      }
      const expCanvas = res[0].node
      expCanvas.width = dims.width
      expCanvas.height = dims.height
      const expCtx = expCanvas.getContext('2d')

      renderCraftSheet(expCtx, grid.value, currentPalette.value.name, colorStats.value, dims)

      uni.canvasToTempFilePath({
        canvas: expCanvas,
        fileType: 'png',
        quality: 1,
        success: (saveRes) => {
          uni.hideLoading()
          saveSheetImage(saveRes.tempFilePath)
        },
        fail: () => {
          uni.hideLoading()
          uni.showToast({ title: '导出失败', icon: 'none' })
        }
      })
    })
  // #endif
}

onMounted(() => {
  // 默认加载第一个像素样图（超级蘑菇），让玩家开箱即玩
  loadSample(SAMPLES[0])
})
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: #0f1013;
  color: #f1f2f6;
  overflow: hidden;
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #16171d;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-icon {
  font-size: 20px;
}

.title-meta {
  display: flex;
  flex-direction: column;
}

.main-title {
  font-size: 15px;
  font-weight: bold;
  color: #ffffff;
}

.sub-title {
  font-size: 10px;
  color: #94a3b8;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-btn {
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}

.nav-btn.primary {
  background: #3b82f6;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

.canvas-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
  backdrop-filter: blur(4px);
}

.picker-modal {
  width: 100%;
  max-width: 380px;
  background: #1e2029;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.picker-title {
  font-size: 15px;
  font-weight: bold;
  color: #ffffff;
}

.sample-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 16px;
}

.sample-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.sample-card:active {
  background: rgba(59, 130, 246, 0.15);
  border-color: #3b82f6;
}

.sample-icon {
  font-size: 26px;
  margin-bottom: 4px;
}

.sample-name {
  font-size: 12px;
  font-weight: 600;
  color: #f1f2f6;
}

.sample-desc {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
}

.offscreen-wrapper {
  position: absolute;
  left: -9999px;
  top: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.export-canvas {
  width: 100px;
  height: 100px;
}
</style>
