import React, { useState, useEffect } from 'react'
import { View, Text, Input, Switch, Button } from '@tarojs/components'
import { getAllPalettes } from '@/palettes'
import type { BeadBrand } from '@/palettes/types'
import './ConfigModal.scss'

export interface ConfigModalProps {
  visible: boolean
  brand: BeadBrand
  width: number
  height: number
  dither: boolean
  onClose: () => void
  onApply: (payload: { brand: BeadBrand; width: number; height: number; dither: boolean }) => void
}

const presets = [
  { label: '小方板', w: 16, h: 16 },
  { label: '经典小板', w: 29, h: 29 },
  { label: '标准大方板', w: 50, h: 50 },
  { label: '经典大方板', w: 52, h: 52 }
]

export const ConfigModal: React.FC<ConfigModalProps> = ({
  visible,
  brand,
  width,
  height,
  dither,
  onClose,
  onApply
}) => {
  const palettes = getAllPalettes()
  const [currentBrand, setCurrentBrand] = useState<BeadBrand>(brand)
  const [boardWidth, setBoardWidth] = useState<number>(width)
  const [boardHeight, setBoardHeight] = useState<number>(height)
  const [isDither, setIsDither] = useState<boolean>(dither)

  useEffect(() => {
    if (visible) {
      setCurrentBrand(brand)
      setBoardWidth(width)
      setBoardHeight(height)
      setIsDither(dither)
    }
  }, [visible, brand, width, height, dither])

  if (!visible) return null

  const handleConfirm = () => {
    onApply({
      brand: currentBrand,
      width: Math.max(8, Math.min(100, Number(boardWidth) || 29)),
      height: Math.max(8, Math.min(100, Number(boardHeight) || 29)),
      dither: isDither
    })
    onClose()
  }

  return (
    <View className="modal-overlay" onClick={onClose}>
      <View className="modal-content" onClick={e => e.stopPropagation()}>
        <View className="modal-header">
          <Text className="modal-title">拼豆生成参数设置</Text>
          <View className="close-btn" onClick={onClose}>
            ✕
          </View>
        </View>

        <View className="modal-body">
          {/* 品牌色卡选择 */}
          <View className="form-section">
            <Text className="section-label">品牌色卡</Text>
            <View className="pill-group">
              {palettes.map(p => (
                <View
                  key={p.id}
                  className={`pill-btn ${currentBrand === p.id ? 'active' : ''}`}
                  onClick={() => setCurrentBrand(p.id)}
                >
                  <Text className="pill-title">{p.name}</Text>
                  <Text className="pill-desc">{p.colors.length} 色</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 底板尺寸规格 */}
          <View className="form-section">
            <Text className="section-label">底板尺寸规格 (宽 × 高)</Text>
            <View className="board-presets">
              {presets.map(preset => (
                <View
                  key={preset.label}
                  className={`preset-btn ${
                    boardWidth === preset.w && boardHeight === preset.h ? 'active' : ''
                  }`}
                  onClick={() => {
                    setBoardWidth(preset.w)
                    setBoardHeight(preset.h)
                  }}
                >
                  <Text className="preset-name">{preset.label}</Text>
                  <Text className="preset-sub">
                    {preset.w}×{preset.h}
                  </Text>
                </View>
              ))}
            </View>

            {/* 自定义输入 */}
            <View className="custom-inputs">
              <View className="input-wrap">
                <Text className="input-prefix">宽:</Text>
                <Input
                  type="number"
                  className="num-input"
                  value={String(boardWidth)}
                  onInput={e => setBoardWidth(Number(e.detail.value))}
                />
              </View>
              <Text className="x-mark">×</Text>
              <View className="input-wrap">
                <Text className="input-prefix">高:</Text>
                <Input
                  type="number"
                  className="num-input"
                  value={String(boardHeight)}
                  onInput={e => setBoardHeight(Number(e.detail.value))}
                />
              </View>
            </View>
          </View>

          {/* 算法抖动选项 */}
          <View className="form-section inline-row">
            <View className="row-info">
              <Text className="section-label">误差扩散抖动 (Floyd-Steinberg)</Text>
              <Text className="field-hint">渐变色更丰富（动漫风格建议关闭）</Text>
            </View>
            <Switch
              checked={isDither}
              color="#3b82f6"
              onChange={e => setIsDither(e.detail.value)}
            />
          </View>
        </View>

        <View className="modal-footer">
          <Button className="btn secondary" onClick={onClose}>
            取消
          </Button>
          <Button className="btn primary" onClick={handleConfirm}>
            重新生成图纸
          </Button>
        </View>
      </View>
    </View>
  )
}
