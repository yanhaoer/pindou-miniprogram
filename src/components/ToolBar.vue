<template>
  <view class="toolbar-wrapper">
    <view class="tool-group">
      <!-- 模式/工具切换 -->
      <view
        class="tool-btn"
        :class="{ active: currentTool === 'view' }"
        @tap="selectTool('view')"
        title="平移缩放"
      >
        <text class="icon">🖐️</text>
        <text class="label">平移</text>
      </view>

      <view
        class="tool-btn"
        :class="{ active: currentTool === 'pencil' }"
        @tap="selectTool('pencil')"
        title="画笔"
      >
        <text class="icon">✏️</text>
        <text class="label">画笔</text>
      </view>

      <view
        class="tool-btn"
        :class="{ active: currentTool === 'bucket' }"
        @tap="selectTool('bucket')"
        title="油漆桶"
      >
        <text class="icon">🪣</text>
        <text class="label">填色</text>
      </view>

      <view
        class="tool-btn"
        :class="{ active: currentTool === 'eyedropper' }"
        @tap="selectTool('eyedropper')"
        title="吸管取色"
      >
        <text class="icon">💧</text>
        <text class="label">吸管</text>
      </view>

      <view
        class="tool-btn"
        :class="{ active: currentTool === 'eraser' }"
        @tap="selectTool('eraser')"
        title="橡皮擦"
      >
        <text class="icon">🧹</text>
        <text class="label">擦除</text>
      </view>
    </view>

    <!-- 撤销/重做与快捷操作 -->
    <view class="action-group">
      <view
        class="action-btn"
        :class="{ disabled: !canUndo }"
        @tap="canUndo && emit('undo')"
        title="撤销"
      >
        <text class="action-icon">↩️</text>
      </view>
      <view
        class="action-btn"
        :class="{ disabled: !canRedo }"
        @tap="canRedo && emit('redo')"
        title="重做"
      >
        <text class="action-icon">↪️</text>
      </view>
      <view class="divider"></view>
      <view class="action-btn primary" @tap="emit('open-config')" title="板子与色卡配置">
        <text class="action-icon">⚙️</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
export type EditTool = 'view' | 'pencil' | 'bucket' | 'eyedropper' | 'eraser'

const props = defineProps<{
  currentTool: EditTool
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  (e: 'update:currentTool', tool: EditTool): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'open-config'): void
}>()

function selectTool(tool: EditTool) {
  emit('update:currentTool', tool)
}
</script>

<style scoped>
.toolbar-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #18191f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 44px;
}

.tool-btn.active {
  background: #3b82f6;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

.tool-btn .icon {
  font-size: 15px;
}

.tool-btn .label {
  font-size: 10px;
  color: #cfd3dc;
  margin-top: 1px;
}

.tool-btn.active .label {
  color: #ffffff;
  font-weight: bold;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
}

.action-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn.primary {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.action-icon {
  font-size: 14px;
}

.divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 2px;
}
</style>
