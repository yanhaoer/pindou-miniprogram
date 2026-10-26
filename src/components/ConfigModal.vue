<template>
  <view v-if="visible" class="modal-overlay" @tap.self="close">
    <view class="modal-content">
      <view class="modal-header">
        <text class="modal-title">拼豆生成参数设置</text>
        <view class="close-btn" @tap="close">✕</view>
      </view>

      <view class="modal-body">
        <!-- 品牌色卡选择 -->
        <view class="form-section">
          <text class="section-label">品牌色卡</text>
          <view class="pill-group">
            <view
              v-for="p in palettes"
              :key="p.id"
              class="pill-btn"
              :class="{ active: currentBrand === p.id }"
              @tap="currentBrand = p.id"
            >
              <text class="pill-title">{{ p.name }}</text>
              <text class="pill-desc">{{ p.colors.length }} 色</text>
            </view>
          </view>
        </view>

        <!-- 底板尺寸规格 -->
        <view class="form-section">
          <text class="section-label">底板尺寸规格 (宽 × 高)</text>
          <view class="board-presets">
            <view
              v-for="preset in presets"
              :key="preset.label"
              class="preset-btn"
              :class="{ active: boardWidth === preset.w && boardHeight === preset.h }"
              @tap="setPreset(preset.w, preset.h)"
            >
              <text class="preset-name">{{ preset.label }}</text>
              <text class="preset-sub">{{ preset.w }}×{{ preset.h }}</text>
            </view>
          </view>

          <!-- 自定义输入 -->
          <view class="custom-inputs">
            <view class="input-wrap">
              <text class="input-prefix">宽:</text>
              <input
                type="number"
                class="num-input"
                v-model.number="boardWidth"
                min="8"
                max="100"
              />
            </view>
            <text class="x-mark">×</text>
            <view class="input-wrap">
              <text class="input-prefix">高:</text>
              <input
                type="number"
                class="num-input"
                v-model.number="boardHeight"
                min="8"
                max="100"
              />
            </view>
          </view>
        </view>

        <!-- 算法抖动选项 -->
        <view class="form-section inline-row">
          <view class="row-info">
            <text class="section-label">误差扩散抖动 (Floyd-Steinberg)</text>
            <text class="field-hint">渐变色更丰富（动漫风格建议关闭）</text>
          </view>
          <switch :checked="dither" color="#3b82f6" @change="e => (dither = e.detail.value)" />
        </view>
      </view>

      <view class="modal-footer">
        <button class="btn secondary" @tap="close">取消</button>
        <button class="btn primary" @tap="confirm">重新生成图纸</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getAllPalettes } from '@/palettes'
import type { BeadBrand } from '@/palettes/types'

const props = defineProps<{
  visible: boolean
  brand: BeadBrand
  width: number
  height: number
  dither: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'apply', payload: { brand: BeadBrand; width: number; height: number; dither: boolean }): void
}>()

const palettes = getAllPalettes()
const currentBrand = ref<BeadBrand>(props.brand)
const boardWidth = ref(props.width)
const boardHeight = ref(props.height)
const dither = ref(props.dither)

const presets = [
  { label: '小方板', w: 16, h: 16 },
  { label: '经典小板', w: 29, h: 29 },
  { label: '标准大方板', w: 50, h: 50 },
  { label: '经典大方板', w: 52, h: 52 }
]

function setPreset(w: number, h: number) {
  boardWidth.value = w
  boardHeight.value = h
}

function close() {
  emit('update:visible', false)
}

function confirm() {
  emit('apply', {
    brand: currentBrand.value,
    width: Math.max(8, Math.min(100, boardWidth.value || 29)),
    height: Math.max(8, Math.min(100, boardHeight.value || 29)),
    dither: dither.value
  })
  close()
}

watch(
  () => props.visible,
  val => {
    if (val) {
      currentBrand.value = props.brand
      boardWidth.value = props.width
      boardHeight.value = props.height
      dither.value = props.dither
    }
  }
)
</script>

<style scoped>
.modal-overlay {
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

.modal-content {
  width: 100%;
  max-width: 420px;
  background: #1e2029;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-title {
  font-size: 16px;
  font-weight: bold;
  color: #ffffff;
}

.close-btn {
  font-size: 16px;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
}

.modal-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-section.inline-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.field-hint {
  font-size: 11px;
  color: #94a3b8;
}

.pill-group {
  display: flex;
  gap: 8px;
}

.pill-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1.5px solid transparent;
  padding: 8px 6px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.pill-btn.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
}

.pill-title {
  font-size: 12px;
  font-weight: bold;
  color: #ffffff;
}

.pill-desc {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
}

.board-presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.preset-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.preset-btn.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.2);
}

.preset-name {
  font-size: 11px;
  color: #f1f2f6;
}

.preset-sub {
  font-size: 10px;
  color: #38bdf8;
  font-family: monospace;
}

.custom-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4px 10px;
}

.input-prefix {
  font-size: 12px;
  color: #94a3b8;
  margin-right: 6px;
}

.num-input {
  color: #ffffff;
  font-size: 13px;
  font-family: monospace;
}

.x-mark {
  color: #94a3b8;
  font-weight: bold;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 14px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  padding: 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}

.btn.primary {
  background: #3b82f6;
  color: #ffffff;
}
</style>
