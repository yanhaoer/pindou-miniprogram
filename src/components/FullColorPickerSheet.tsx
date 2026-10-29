import React, { useState, useMemo } from 'react'
import { View, Text, Input, ScrollView, RootPortal } from '@tarojs/components'
import { getPalette } from '@/palettes'
import type { BeadBrand, BeadColor } from '@/palettes/types'
import {
  filterBeadColors,
  COLOR_CATEGORIES,
  type ColorCategory
} from '@/utils/color-filter'
import './FullColorPickerSheet.scss'

export interface FullColorPickerSheetProps {
  visible: boolean
  brand: BeadBrand
  targetPos: { x: number; y: number } | null
  currentCellColor?: BeadColor | null
  inUseColors?: BeadColor[]
  onClose: () => void
  onSelectColor: (color: BeadColor, pos: { x: number; y: number }) => void
}

export const FullColorPickerSheet: React.FC<FullColorPickerSheetProps> = ({
  visible,
  brand,
  targetPos,
  currentCellColor,
  inUseColors = [],
  onClose,
  onSelectColor
}) => {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ColorCategory>('全部')

  const fullPalette = useMemo(() => getPalette(brand), [brand])

  const filteredColors = useMemo(() => {
    return filterBeadColors(fullPalette.colors, {
      search,
      category: selectedCategory,
      inUseColors
    })
  }, [fullPalette.colors, search, selectedCategory, inUseColors])

  if (!visible) return null

  const handlePickColor = (color: BeadColor) => {
    if (targetPos) {
      onSelectColor(color, targetPos)
    }
  }

  return (
    <RootPortal enable>
      <View className="full-color-picker-overlay" onClick={onClose}>
        <View
          className="full-color-picker-sheet"
          onClick={e => e.stopPropagation()}
        >
          {/* 抽屉头部 */}
          <View className="sheet-header">
            <View className="header-left">
              <Text className="sheet-title">
                {targetPos
                  ? `更改方块颜色 (${targetPos.x + 1}, ${targetPos.y + 1})`
                  : '选择拼豆画色'}
              </Text>
              <Text className="sheet-subtitle">
                {fullPalette.name} · 共 {fullPalette.colors.length} 色
              </Text>
            </View>
            <View className="sheet-close-btn" onClick={onClose}>
              ✕
            </View>
          </View>

          {/* 当前方块对比卡片 */}
          {currentCellColor && (
            <View className="target-cell-bar">
              <Text className="bar-label">原方块颜色:</Text>
              <View className="cell-color-tag">
                <View
                  className="swatch"
                  style={{ backgroundColor: currentCellColor.hex }}
                />
                <Text className="code">{currentCellColor.code}</Text>
                <Text className="name">{currentCellColor.name}</Text>
              </View>
            </View>
          )}

          {/* 实时搜索栏 */}
          <View className="sheet-search-wrap">
            <View className="search-input-box">
              <Text className="search-icon">🔍</Text>
              <Input
                className="search-input"
                placeholder="搜索色号代码 (如 A01) 或名称..."
                value={search}
                onInput={e => setSearch(e.detail.value)}
              />
              {search && (
                <Text className="clear-btn" onClick={() => setSearch('')}>
                  ✕
                </Text>
              )}
            </View>
          </View>

          {/* 色系分类快捷标签 */}
          <ScrollView className="category-tabs-scroll" scrollX enableFlex>
            <View className="category-tabs">
              {COLOR_CATEGORIES.map(cat => (
                <View
                  key={cat}
                  className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <Text>{cat}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* 全量色卡展示网格 */}
          <ScrollView className="colors-grid-scroll" scrollY enableFlex>
            {filteredColors.length === 0 ? (
              <View className="empty-search-state">
                <Text className="empty-icon">🎨</Text>
                <Text>未找到符合条件的色号</Text>
              </View>
            ) : (
              <View className="colors-grid">
                {filteredColors.map(color => {
                  const isCurrent = currentCellColor?.code === color.code
                  return (
                    <View
                      key={color.code}
                      className={`color-option-card ${isCurrent ? 'current-selected' : ''}`}
                      onClick={() => handlePickColor(color)}
                    >
                      <View
                        className="swatch-box"
                        style={{ backgroundColor: color.hex }}
                      />
                      <Text className="color-code">{color.code}</Text>
                      <Text className="color-name">{color.name}</Text>
                    </View>
                  )
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </RootPortal>
  )
}
