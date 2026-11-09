import React, { useState, useEffect } from 'react'
import { View, Text, Image, Button, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  UserProfile,
  saveUserProfile,
  performWechatLogin,
  DEFAULT_GUEST_PROFILE,
  syncUserWithCloud
} from '@/utils/user'
import defaultAvatar from '@/assets/xiaogua.png'
import './LoginModal.scss'

export interface LoginModalProps {
  isOpen: boolean
  theme: 'dark' | 'light'
  initialProfile?: UserProfile
  onClose: () => void
  onSuccess: (profile: UserProfile) => void
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  theme,
  initialProfile,
  onClose,
  onSuccess
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [nickName, setNickName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  useEffect(() => {
    if (isOpen) {
      if (initialProfile && initialProfile.isLoggedIn) {
        setAvatarUrl(initialProfile.avatarUrl || '')
        setNickName(initialProfile.nickName || '')
      } else {
        setAvatarUrl('')
        setNickName('')
      }
    }
  }, [isOpen, initialProfile])

  if (!isOpen) return null

  const handleChooseAvatar = (e: any) => {
    const chosen = e?.detail?.avatarUrl
    if (chosen) {
      setAvatarUrl(chosen)
    }
  }

  const handleNicknameChange = (e: any) => {
    const val = e?.detail?.value
    if (typeof val === 'string') {
      setNickName(val)
    }
  }

  const handleConfirmLogin = async () => {
    const trimmedNick = nickName.trim()
    if (!trimmedNick || trimmedNick === DEFAULT_GUEST_PROFILE.nickName) {
      Taro.showToast({
        title: '请输入或选用微信昵称',
        icon: 'none'
      })
      return
    }

    setIsSubmitting(true)
    try {
      // 触发微信登录获取 code
      await performWechatLogin()

      const saved = saveUserProfile({
        isLoggedIn: true,
        nickName: trimmedNick,
        avatarUrl: avatarUrl || ''
      })

      // 异步调用云端档案同步，不阻塞即时登录成功响应
      syncUserWithCloud(saved).then((synced) => {
        if (synced) {
          onSuccess(synced)
        }
      }).catch((err) => {
        console.warn('[LoginModal] Failed to sync profile with cloud:', err)
      })

      Taro.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 2000
      })

      onSuccess(saved)
      onClose()
    } catch (err) {
      console.error('Login error', err)
      Taro.showToast({
        title: '登录异常，请重试',
        icon: 'none'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View className={`login-modal-overlay theme-${theme}`} onClick={onClose}>
      <View
        className="login-modal-content"
        onClick={(e) => {
          if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation()
          }
        }}
      >
        {/* 顶部标题与关闭 */}
        <View className="modal-header">
          <View className="title-group">
            <Text className="modal-title">微信授权登录</Text>
            <Text className="modal-subtitle">同步微信头像与昵称，开启拼豆手作记录</Text>
          </View>
          <View className="close-btn" onClick={onClose}>
            <Text className="close-icon">✕</Text>
          </View>
        </View>

        {/* 头像选择 */}
        <View className="form-section avatar-section">
          <Text className="section-label">头像设置</Text>
          <Button
            className="avatar-pick-button"
            openType="chooseAvatar"
            onChooseAvatar={handleChooseAvatar}
          >
            <View className="avatar-preview-wrap">
              <Image
                src={avatarUrl || defaultAvatar}
                className="avatar-img"
                mode="aspectFill"
              />
              <View className="camera-badge">
                <Text className="camera-icon">📷</Text>
              </View>
            </View>
          </Button>
          <Text className="avatar-hint">点击头像一键选用微信头像</Text>
        </View>

        {/* 昵称输入 */}
        <View className="form-section nickname-section">
          <Text className="section-label">用户昵称</Text>
          <View className="nickname-input-wrap">
            <Input
              type="nickname"
              className="nickname-input"
              placeholder="请输入或选择微信昵称"
              value={nickName}
              onInput={handleNicknameChange}
              onBlur={handleNicknameChange}
            />
          </View>
          <Text className="input-hint">键盘弹起时可一键带入微信昵称</Text>
        </View>

        {/* 底部确认按钮 */}
        <View className="modal-footer">
          <Button
            className={`submit-login-btn ${isSubmitting ? 'submitting' : ''}`}
            onClick={handleConfirmLogin}
            loading={isSubmitting}
          >
            <Text className="submit-text">确认并保存资料</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}
