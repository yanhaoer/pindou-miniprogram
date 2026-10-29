import React from 'react'
import { View, Text } from '@tarojs/components'
import './QuickActionBar.scss'

export interface QuickActionBarProps {
  showColorCodes: boolean
  showRulers: boolean
  onToggleColorCodes: () => void
  onToggleRulers: () => void
  onMirrorHorizontal: () => void
  onOpenConfig?: () => void
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  showColorCodes,
  showRulers,
  onToggleColorCodes,
  onToggleRulers,
  onMirrorHorizontal,
  onOpenConfig
}) => {
  return (
    <View className="quick-action-bar">
      <View
        className="action-pill-btn"
        onClick={onMirrorHorizontal}
        hoverClass="btn-hover"
      >
        <Text className="action-icon">↔</Text>
        <Text className="action-label">镜像</Text>
      </View>

      <View
        className={`action-pill-btn toggle-code-btn ${showColorCodes ? 'active' : ''}`}
        onClick={onToggleColorCodes}
        hoverClass="btn-hover"
      >
        <Text className="action-icon">#</Text>
        <Text className="action-label">{showColorCodes ? '隐藏色号' : '显示色号'}</Text>
      </View>

      <View
        className={`action-pill-btn toggle-ruler-btn ${showRulers ? 'active' : ''}`}
        onClick={onToggleRulers}
        hoverClass="btn-hover"
      >
        <Text className="action-icon">📐</Text>
        <Text className="action-label">{showRulers ? '隐藏刻度' : '显示刻度'}</Text>
      </View>

      {onOpenConfig && (
        <View
          className="action-pill-btn config-btn"
          onClick={onOpenConfig}
          hoverClass="btn-hover"
        >
          <Text className="action-icon">⚙️</Text>
          <Text className="action-label">设置</Text>
        </View>
      )}
    </View>
  )
}
