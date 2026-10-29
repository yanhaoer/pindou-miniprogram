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
  onOpenConfig?: () => void
  onExport?: () => void
}

const tools: { id: EditTool; name: string; icon: string }[] = [
  { id: 'view', name: '平移', icon: '🖐️' },
  { id: 'pencil', name: '画笔', icon: '✏️' },
  { id: 'bucket', name: '填色', icon: '🪣' },
  { id: 'eyedropper', name: '吸色', icon: '💧' },
  { id: 'eraser', name: '橡皮', icon: '🧹' }
]

export const ToolBar: React.FC<ToolBarProps> = ({
  currentTool,
  canUndo,
  canRedo,
  onSelectTool,
  onUndo,
  onRedo
}) => {
  return (
    <View className="toolbar-wrapper">
      {tools.map(tool => (
        <View
          key={tool.id}
          className={`tool-btn ${currentTool === tool.id ? 'active' : ''}`}
          onClick={() => onSelectTool(tool.id)}
        >
          <Text className="icon">{tool.icon}</Text>
          <Text className="label">{tool.name}</Text>
        </View>
      ))}

      <View
        className={`tool-btn action-btn ${!canUndo ? 'disabled' : ''}`}
        onClick={() => canUndo && onUndo()}
      >
        <Text className="icon">↩️</Text>
        <Text className="label">撤销</Text>
      </View>

      <View
        className={`tool-btn action-btn ${!canRedo ? 'disabled' : ''}`}
        onClick={() => canRedo && onRedo()}
      >
        <Text className="icon">↪️</Text>
        <Text className="label">重做</Text>
      </View>
    </View>
  )
}
