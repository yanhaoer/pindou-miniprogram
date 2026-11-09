import React, { useState, useEffect } from 'react'
import { View, Text, Input, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { callCloudFunction } from '@/utils/cloud'
import './PublishModal.scss'

export const PUBLISH_TAGS = ['复古游戏', '可爱萌宠', '热门动漫', '美食小物', '其他']

export interface PublishModalProps {
  isOpen: boolean
  draft: any
  theme?: 'dark' | 'light'
  onClose: () => void
  onSuccess?: (result: any) => void
}

export interface PublishSubmitParams {
  draft: any
  title: string
  tag: string
  onSuccess?: (result: any) => void
  onClose?: () => void
}

/**
 * Handles publish submit logic, error handling for security rejection (40001),
 * and user toast feedback.
 */
export async function handlePublishSubmit({
  draft,
  title,
  tag,
  onSuccess,
  onClose
}: PublishSubmitParams): Promise<boolean> {
  const trimmedTitle = (title || '').trim()
  if (!trimmedTitle) {
    Taro.showToast({
      title: '请输入作品标题',
      icon: 'none'
    })
    return false
  }

  const colorsCount = draft?.color_summary
    ? Object.keys(draft.color_summary).length
    : (draft?.colors_count || 0)

  const sizeDesc = draft?.width && draft?.height
    ? `${draft.width}×${draft.height}`
    : '标准'

  try {
    const res = await callCloudFunction('plaza.publish', {
      pattern_id: draft?._id,
      title: trimmedTitle,
      tag: tag || '其他',
      preview_url: draft?.preview_url || '',
      size_desc: sizeDesc,
      colors_count: colorsCount
    })

    Taro.showToast({
      title: '发布成功',
      icon: 'success'
    })

    if (typeof onSuccess === 'function') {
      onSuccess(res)
    }
    if (typeof onClose === 'function') {
      onClose()
    }
    return true
  } catch (err: any) {
    const errMsg = err?.message || ''
    const isSensitive =
      err?.code === 40001 ||
      errMsg.includes('40001') ||
      errMsg.includes('合规') ||
      errMsg.includes('敏感') ||
      errMsg.includes('违规')

    if (isSensitive) {
      Taro.showToast({
        title: '标题或标签包含违规敏感内容，请修改后重试',
        icon: 'none'
      })
    } else {
      Taro.showToast({
        title: errMsg || '发布失败，请重试',
        icon: 'none'
      })
    }
    return false
  }
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  draft,
  theme = 'dark',
  onClose,
  onSuccess
}) => {
  const [title, setTitle] = useState('')
  const [selectedTag, setSelectedTag] = useState(PUBLISH_TAGS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && draft) {
      setTitle(draft.title || '')
      setSelectedTag(PUBLISH_TAGS[0])
      setIsSubmitting(false)
    }
  }, [isOpen, draft])

  if (!isOpen || !draft) return null

  const handleTitleInput = (e: any) => {
    const val = e?.detail?.value
    if (typeof val === 'string') {
      setTitle(val)
    }
  }

  const onSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await handlePublishSubmit({
        draft,
        title,
        tag: selectedTag,
        onSuccess,
        onClose
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const colorsCount = draft?.color_summary
    ? Object.keys(draft.color_summary).length
    : (draft?.colors_count || 0)

  return (
    <View
      className={`publish-modal-overlay theme-${theme}`}
      onClick={onClose}
    >
      <View
        className="publish-modal-content"
        onClick={(e) => {
          if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation()
          }
        }}
      >
        {/* Header */}
        <View className="modal-header">
          <View className="title-group">
            <Text className="modal-title">发布到灵感广场</Text>
            <Text className="modal-subtitle">与拼豆同好分享你的精美创作</Text>
          </View>
          <View className="close-btn" onClick={onClose}>
            <Text className="close-icon">✕</Text>
          </View>
        </View>

        {/* Draft Summary Card */}
        <View className="draft-preview-card">
          <View className="draft-thumbnail-wrap">
            {draft.preview_url ? (
              <Image
                src={draft.preview_url}
                className="draft-thumbnail"
                mode="aspectFit"
              />
            ) : (
              <View className="draft-thumbnail-placeholder">
                <Text className="placeholder-icon">🎨</Text>
              </View>
            )}
          </View>
          <View className="draft-info">
            <Text className="draft-orig-title">{draft.title || '未命名图纸'}</Text>
            <View className="draft-meta-tags">
              <Text className="meta-pill size-pill">{draft.width}×{draft.height}</Text>
              <Text className="meta-pill brand-pill">{(draft.brand || 'ARTKAL').toUpperCase()}</Text>
              <Text className="meta-pill color-pill">{colorsCount} 色</Text>
            </View>
          </View>
        </View>

        {/* Title Input */}
        <View className="form-section">
          <Text className="section-label">作品名称 / 标题</Text>
          <View className="input-wrap">
            <Input
              className="title-input"
              value={title}
              onInput={handleTitleInput}
              maxlength={30}
              placeholder="给作品起个响亮的名字吧~"
              placeholderClass="input-placeholder"
            />
            <Text className="char-count">{title.length}/30</Text>
          </View>
        </View>

        {/* Category Tag Selector */}
        <View className="form-section">
          <Text className="section-label">选择分类标签</Text>
          <View className="tag-pills-row">
            {PUBLISH_TAGS.map((tag) => {
              const isActive = tag === selectedTag
              return (
                <View
                  key={tag}
                  className={`tag-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedTag(tag)}
                >
                  <Text className="tag-text">{tag}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Action Buttons */}
        <View className="modal-actions">
          <Button className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
          <Button
            className="btn-submit"
            onClick={onSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? '正在发布...' : '确认发布'}
          </Button>
        </View>
      </View>
    </View>
  )
}
export default PublishModal
