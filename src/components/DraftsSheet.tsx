import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Image, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { callCloudFunction } from '@/utils/cloud'
import { PublishModal } from './PublishModal'
import './DraftsSheet.scss'

export interface DraftItem {
  _id: string
  title: string
  width: number
  height: number
  brand?: string
  preview_url?: string
  color_summary?: Record<string, number>
  colors_count?: number
  created_at?: string | number | Date
  updated_at?: string | number | Date
  [key: string]: any
}

export interface DraftsSheetProps {
  isOpen: boolean
  theme?: 'dark' | 'light'
  onClose: () => void
  onSelectDraft: (patternId: string) => void
  onPublish?: (draft: DraftItem) => void
  onPublishSuccess?: (published: any) => void
  onDeleteSuccess?: (draftId: string) => void
}

/**
 * Format draft update time into human-readable string
 */
export function formatDraftTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '未知时间'
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return '未知时间'

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')

  const now = new Date()
  const isToday =
    now.getFullYear() === y &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()

  if (isToday) {
    return `今天 ${hh}:${mm}`
  }
  return `${m}-${d} ${hh}:${mm}`
}

/**
 * Compute the number of colors used in a draft
 */
export function getDraftColorCount(draft?: DraftItem | null): number {
  if (!draft) return 0
  if (draft.color_summary && typeof draft.color_summary === 'object') {
    return Object.keys(draft.color_summary).length
  }
  if (typeof draft.colors_count === 'number') {
    return draft.colors_count
  }
  return 0
}

export const DraftsSheet: React.FC<DraftsSheetProps> = ({
  isOpen,
  theme = 'dark',
  onClose,
  onSelectDraft,
  onPublish,
  onPublishSuccess,
  onDeleteSuccess
}) => {
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [publishingDraft, setPublishingDraft] = useState<DraftItem | null>(null)

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await callCloudFunction<{ list: DraftItem[] }>('pattern.listMine', {
        page: 1,
        pageSize: 30
      })
      setDrafts(res?.list || [])
    } catch (err: any) {
      const msg = err?.message || '获取草稿列表失败'
      setErrorMsg(msg)
      Taro.showToast({
        title: msg,
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchDrafts()
    } else {
      setPublishingDraft(null)
    }
  }, [isOpen, fetchDrafts])

  if (!isOpen) return null

  // 载入制作
  const handleLoadDraft = (draft: DraftItem) => {
    onSelectDraft(draft._id)
    onClose()
  }

  // 打开发布弹窗
  const handleOpenPublish = (draft: DraftItem) => {
    if (typeof onPublish === 'function') {
      onPublish(draft)
    }
    setPublishingDraft(draft)
  }

  // 删除草稿（弹窗二次确认）
  const handleDeleteDraft = (draft: DraftItem) => {
    Taro.showModal({
      title: '删除草稿',
      content: `确定要删除“${draft.title || '未命名图纸'}”吗？删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            await callCloudFunction('pattern.delete', { id: draft._id })
            setDrafts((prev) => prev.filter((item) => item._id !== draft._id))
            Taro.showToast({
              title: '已删除草稿',
              icon: 'success'
            })
            if (typeof onDeleteSuccess === 'function') {
              onDeleteSuccess(draft._id)
            }
          } catch (err: any) {
            Taro.showToast({
              title: err?.message || '删除失败，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  }

  return (
    <View className={`drafts-sheet-overlay theme-${theme}`} onClick={onClose}>
      <View
        className="drafts-sheet-content"
        onClick={(e) => {
          if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation()
          }
        }}
      >
        {/* 顶部拉手与标题栏 */}
        <View className="sheet-handle" />
        <View className="sheet-header">
          <View className="title-group">
            <Text className="sheet-title">我的制作草稿箱</Text>
            {!loading && drafts.length > 0 && (
              <Text className="sheet-badge">共 {drafts.length} 份</Text>
            )}
          </View>
          <View className="close-btn" onClick={onClose}>
            <Text className="close-icon">✕</Text>
          </View>
        </View>

        {/* 列表主体区域 */}
        <ScrollView scrollY className="drafts-list-scroll">
          {loading ? (
            <View className="skeleton-container">
              {[1, 2, 3].map((key) => (
                <View key={key} className="draft-card skeleton-card">
                  <View className="skeleton-thumb" />
                  <View className="skeleton-details">
                    <View className="skeleton-line title" />
                    <View className="skeleton-line meta" />
                    <View className="skeleton-line actions" />
                  </View>
                </View>
              ))}
            </View>
          ) : errorMsg ? (
            <View className="error-container">
              <Text className="error-icon">⚠️</Text>
              <Text className="error-text">{errorMsg}</Text>
              <Button className="btn-retry" onClick={fetchDrafts}>
                重新加载
              </Button>
            </View>
          ) : drafts.length === 0 ? (
            <View className="empty-container">
              <View className="empty-icon-wrap">
                <Text className="empty-icon">🎨</Text>
              </View>
              <Text className="empty-text">暂无制作草稿，快去画板创作吧！</Text>
              <Text className="empty-subtext">在画布中编辑的图纸可随时保存到云端草稿箱</Text>
            </View>
          ) : (
            <View className="drafts-card-list">
              {drafts.map((draft) => {
                const colorCount = getDraftColorCount(draft)
                const brandName = (draft.brand || 'ARTKAL').toUpperCase()
                const timeText = formatDraftTime(draft.updated_at || draft.created_at)

                return (
                  <View key={draft._id} className="draft-card">
                    {/* 缩略图与尺寸徽章 */}
                    <View className="card-thumb-wrap">
                      {draft.preview_url ? (
                        <Image
                          src={draft.preview_url}
                          className="card-thumb-img"
                          mode="aspectFit"
                        />
                      ) : (
                        <View className="card-thumb-placeholder">
                          <Text className="thumb-icon">🧩</Text>
                        </View>
                      )}
                      <View className="dimension-badge">
                        <Text className="dimension-text">{draft.width}×{draft.height}</Text>
                      </View>
                    </View>

                    {/* 卡片中央信息 */}
                    <View className="card-main">
                      <View className="card-header-row">
                        <Text className="card-title" numberOfLines={1}>
                          {draft.title || '未命名图纸'}
                        </Text>
                        <Text className="card-time">{timeText}</Text>
                      </View>

                      <View className="card-tags-row">
                        <Text className="tag-pill brand-pill">{brandName}</Text>
                        <Text className="tag-pill color-pill">{colorCount} 种颜色</Text>
                      </View>

                      {/* 卡片底部操作按钮 */}
                      <View className="card-actions-row">
                        <View
                          className="btn-action btn-delete"
                          onClick={() => handleDeleteDraft(draft)}
                        >
                          <Text className="action-text delete-text">删除</Text>
                        </View>

                        <View className="action-right-group">
                          <View
                            className="btn-action btn-publish"
                            onClick={() => handleOpenPublish(draft)}
                          >
                            <Text className="action-text publish-text">发布广场</Text>
                          </View>
                          <View
                            className="btn-action btn-load"
                            onClick={() => handleLoadDraft(draft)}
                          >
                            <Text className="action-text load-text">载入制作</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </ScrollView>

        {/* 发布弹窗 */}
        {publishingDraft && (
          <PublishModal
            isOpen={!!publishingDraft}
            draft={publishingDraft}
            theme={theme}
            onClose={() => setPublishingDraft(null)}
            onSuccess={(res) => {
              if (typeof onPublishSuccess === 'function') {
                onPublishSuccess(res)
              }
              setPublishingDraft(null)
            }}
          />
        )}
      </View>
    </View>
  )
}
export default DraftsSheet
