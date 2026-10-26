<template>
  <view class="palette-bar-container">
    <!-- 头部摘要与操作 -->
    <view class="bar-header">
      <view class="header-info">
        <text class="title">色号用量清单 (寻豆面板)</text>
        <text class="stats-badge">共 {{ totalBeads }} 颗 · {{ statsList.length }} 色</text>
      </view>

      <view class="header-actions">
        <view
          v-if="selectedColorCode"
          class="clear-highlight-btn"
          @tap="emit('update:selectedColorCode', null)"
        >
          取消高亮
        </view>
        <view class="expand-btn" @tap="isExpanded = !isExpanded">
          {{ isExpanded ? '收起 ▲' : '展开 ▼' }}
        </view>
      </view>
    </view>

    <!-- 高亮提示条 -->
    <view v-if="selectedColorCode" class="active-banner">
      <text class="banner-text">
        正在高亮 <text class="highlight-code">{{ selectedColorCode }}</text> · 需使用
        <text class="highlight-count">{{ currentHighlightCount }}</text> 颗
      </text>
    </view>

    <!-- 滚动色卡列表 -->
    <scroll-view
      class="colors-scroll"
      :class="{ expanded: isExpanded }"
      :scroll-x="!isExpanded"
      :scroll-y="isExpanded"
      enable-flex
    >
      <view class="colors-wrapper" :class="{ 'grid-mode': isExpanded }">
        <view
          v-for="item in statsList"
          :key="item.color.code"
          class="color-card"
          :class="{ active: selectedColorCode === item.color.code }"
          @tap="selectColor(item.color)"
        >
          <!-- 逼真圆珠缩略图 -->
          <view class="bead-swatch-box">
            <view
              class="bead-circle"
              :style="{ backgroundColor: item.color.hex }"
            >
              <view class="bead-hole"></view>
            </view>
          </view>

          <!-- 编号与数量 -->
          <view class="color-meta">
            <text class="color-code">{{ item.color.code }}</text>
            <text class="color-count">{{ item.count }} 颗</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { BeadColor } from '@/palettes/types'
import type { BeadColorStatItem } from '@/utils/quantizer'

const props = defineProps<{
  stats: Map<string, BeadColorStatItem>
  selectedColorCode: string | null
  activeColor: BeadColor | null
}>()

const emit = defineEmits<{
  (e: 'update:selectedColorCode', code: string | null): void
  (e: 'update:activeColor', color: BeadColor): void
}>()

const isExpanded = ref(false)

const statsList = computed(() => {
  const list = Array.from(props.stats.values())
  // 按数量从多到少排序
  return list.sort((a, b) => b.count - a.count)
})

const totalBeads = computed(() => {
  let sum = 0
  props.stats.forEach(item => {
    sum += item.count
  })
  return sum
})

const currentHighlightCount = computed(() => {
  if (!props.selectedColorCode) return 0
  const item = props.stats.get(props.selectedColorCode)
  return item ? item.count : 0
})

function selectColor(color: BeadColor) {
  emit('update:activeColor', color)
  if (props.selectedColorCode === color.code) {
    // 再次点击取消高亮
    emit('update:selectedColorCode', null)
  } else {
    emit('update:selectedColorCode', color.code)
  }
}
</script>

<style scoped>
.palette-bar-container {
  background: #18191f;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.bar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f2f6;
}

.stats-badge {
  font-size: 11px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  padding: 2px 8px;
  border-radius: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-highlight-btn {
  font-size: 11px;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.3);
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.expand-btn {
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
}

.active-banner {
  background: linear-gradient(90deg, rgba(234, 179, 8, 0.2), rgba(234, 179, 8, 0.05));
  padding: 4px 14px;
  border-left: 3px solid #eab308;
}

.banner-text {
  font-size: 11px;
  color: #fef08a;
}

.highlight-code {
  font-weight: bold;
  color: #ffffff;
}

.highlight-count {
  font-weight: bold;
  color: #38bdf8;
}

.colors-scroll {
  width: 100%;
  white-space: nowrap;
  max-height: 82px;
  transition: max-height 0.3s ease;
}

.colors-scroll.expanded {
  max-height: 220px;
}

.colors-wrapper {
  display: flex;
  flex-direction: row;
  padding: 6px 12px 10px 12px;
  gap: 8px;
}

.colors-wrapper.grid-mode {
  flex-wrap: wrap;
  overflow-y: auto;
}

.color-card {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.color-card.active {
  border-color: #eab308;
  background: rgba(234, 179, 8, 0.15);
  box-shadow: 0 0 12px rgba(234, 179, 8, 0.3);
}

.bead-swatch-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.bead-circle {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 1px 1px 3px rgba(255, 255, 255, 0.4), 0 1px 4px rgba(0, 0, 0, 0.4);
}

.bead-hole {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #18191f;
}

.color-meta {
  display: flex;
  flex-direction: column;
}

.color-code {
  font-size: 12px;
  font-weight: bold;
  color: #f1f2f6;
  font-family: monospace;
}

.color-count {
  font-size: 10px;
  color: #94a3b8;
}
</style>
