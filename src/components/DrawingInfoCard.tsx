import React from 'react'
import { View, Text } from '@tarojs/components'
import './DrawingInfoCard.scss'

export interface DrawingInfoCardProps {
  width: number
  height: number
  totalBeads: number
  colorCount: number
}

export const DrawingInfoCard: React.FC<DrawingInfoCardProps> = ({
  width,
  height,
  totalBeads,
  colorCount
}) => {
  return (
    <View className="drawing-info-card">
      <View className="info-card-header">
        <Text className="info-card-title">图片信息</Text>
      </View>

      <View className="info-card-content">
        <View className="info-stat-block">
          <Text className="stat-label">图纸大小</Text>
          <View className="stat-value-group">
            <Text className="stat-value">{width} × {height}</Text>
            <Text className="stat-unit">格</Text>
          </View>
        </View>

        <View className="stat-divider" />

        <View className="info-stat-block">
          <Text className="stat-label">豆子数量</Text>
          <View className="stat-value-group">
            <Text className="stat-value">{totalBeads}</Text>
            <Text className="stat-unit">颗</Text>
          </View>
        </View>

        <View className="stat-divider" />

        <View className="info-stat-block">
          <Text className="stat-label">颜色数量</Text>
          <View className="stat-value-group">
            <Text className="stat-value">{colorCount}</Text>
            <Text className="stat-unit">种</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
