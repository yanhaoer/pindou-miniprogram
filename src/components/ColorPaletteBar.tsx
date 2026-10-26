import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import type { BeadColor } from '@/palettes/types'
import type { BeadColorStatItem } from '@/utils/quantizer'
import './ColorPaletteBar.scss'

export interface ColorPaletteBarProps {
  stats: Map<string, BeadColorStatItem>
  selectedColorCode: string | null
  activeColor: BeadColor | null
  onSelectColorCode: (code: string | null) => void
  onSelectActiveColor: (color: BeadColor) => void
}

export const ColorPaletteBar: React.FC<ColorPaletteBarProps> = ({
  stats,
  selectedColorCode,
  activeColor,
  onSelectColorCode,
  onSelectActiveColor
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const statsList = useMemo(() => {
    const list = Array.from(stats.values())
    return list.sort((a, b) => b.count - a.count)
  }, [stats])

  const totalBeads = useMemo(() => {
    let sum = 0
    stats.forEach(item => {
      sum += item.count
    })
    return sum
  }, [stats])

  const currentHighlightCount = useMemo(() => {
    if (!selectedColorCode) return 0
    const item = stats.get(selectedColorCode)
    return item ? item.count : 0
  }, [selectedColorCode, stats])

  const handleColorClick = (color: BeadColor) => {
    onSelectActiveColor(color)
    if (selectedColorCode === color.code) {
      onSelectColorCode(null)
    } else {
      onSelectColorCode(color.code)
    }
  }

  return (
    <View className="palette-bar-container">
      {/* 头部摘要与操作 */}
      <View className="bar-header">
        <View className="header-info">
          <Text className="title">色号用量清单 (寻豆面板)</Text>
          <Text className="stats-badge">共 {totalBeads} 颗 · {statsList.length} 色</Text>
        </View>

        <View className="header-actions">
          {selectedColorCode && (
            <View
              className="clear-highlight-btn"
              onClick={() => onSelectColorCode(null)}
            >
              取消高亮
            </View>
          )}
          <View
            className="expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '收起 ▲' : '展开 ▼'}
          </View>
        </View>
      </View>

      {/* 高亮提示条 */}
      {selectedColorCode && (
        <View className="active-banner">
          <Text className="banner-text">
            正在高亮 <Text className="highlight-code">{selectedColorCode}</Text> · 需使用{' '}
            <Text className="highlight-count">{currentHighlightCount}</Text> 颗
          </Text>
        </View>
      )}

      {/* 滚动色卡列表 */}
      <ScrollView
        className={`colors-scroll ${isExpanded ? 'expanded' : ''}`}
        scrollX={!isExpanded}
        scrollY={isExpanded}
        // @ts-ignore
        enableFlex
      >
        <View className={`colors-wrapper ${isExpanded ? 'grid-mode' : ''}`}>
          {statsList.map(item => {
            const isSelected = selectedColorCode === item.color.code
            return (
              <View
                key={item.color.code}
                className={`color-card ${isSelected ? 'active' : ''}`}
                onClick={() => handleColorClick(item.color)}
              >
                <View className="bead-swatch-box">
                  <View
                    className="bead-circle"
                    style={{ backgroundColor: item.color.hex }}
                  >
                    <View className="bead-hole" />
                  </View>
                </View>

                <View className="color-meta">
                  <Text className="color-code">{item.color.code}</Text>
                  <Text className="color-count">{item.count} 颗</Text>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}
