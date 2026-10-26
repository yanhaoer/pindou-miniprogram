import React from 'react'
import { View, Text } from '@tarojs/components'
import './ToolBar.scss'

export type EditTool = 'view' | 'pencil' | 'bucket' | 'eyedropper' | 'eraser'

export interface ToolBarProps {
  currentTool: EditTool
  canUndo: boolean
  canRedo: boolean
  onSelectTool: (tool: EditTool) => void
  onUndo: () => void
  onRedo: () => void
  onOpenConfig: () => void
}

export const ToolBar: React.FC<ToolBarProps> = ({
  currentTool,
  canUndo,
  canRedo,
  onSelectTool,
  onUndo,
  onRedo,
  onOpenConfig
}) => {
  return (
    <View className="toolbar-wrapper">
      <View className="tool-group">
        <View
          className={`tool-btn ${currentTool === 'view' ? 'active' : ''}`}
          onClick={() => onSelectTool('view')}
        >
          <Text className="icon">🖐️</Text>
          <Text className="label">平移</Text>
        </View>

        <View
          className={`tool-btn ${currentTool === 'pencil' ? 'active' : ''}`}
          onClick={() => onSelectTool('pencil')}
        >
          <Text className="icon">✏️</Text>
          <Text className="label">画笔</Text>
        </View>

        <View
          className={`tool-btn ${currentTool === 'bucket' ? 'active' : ''}`}
          onClick={() => onSelectTool('bucket')}
        >
          <Text className="icon">🪣</Text>
          <Text className="label">填色</Text>
        </View>

        <View
          className={`tool-btn ${currentTool === 'eyedropper' ? 'active' : ''}`}
          onClick={() => onSelectTool('eyedropper')}
        >
          <Text className="icon">💧</Text>
          <Text className="label">吸管</Text>
        </View>

        <View
          className={`tool-btn ${currentTool === 'eraser' ? 'active' : ''}`}
          onClick={() => onSelectTool('eraser')}
        >
          <Text className="icon">🧹</Text>
          <Text className="label">擦除</Text>
        </View>
      </View>

      <View className="action-group">
        <View
          className={`action-btn ${!canUndo ? 'disabled' : ''}`}
          onClick={() => canUndo && onUndo()}
        >
          <Text className="action-icon">↩️</Text>
        </View>
        <View
          className={`action-btn ${!canRedo ? 'disabled' : ''}`}
          onClick={() => canRedo && onRedo()}
        >
          <Text className="action-icon">↪️</Text>
        </View>
        <View className="divider" />
        <View className="action-btn primary" onClick={onOpenConfig}>
          <Text className="action-icon">⚙️</Text>
        </View>
      </View>
    </View>
  )
}
