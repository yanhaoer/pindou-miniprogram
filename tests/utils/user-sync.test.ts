import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncUserWithCloud, UserProfile, getUserProfile, clearUserProfile } from '../../src/utils/user'
import * as cloud from '../../src/utils/cloud'

describe('User Cloud Sync', () => {
  beforeEach(() => {
    clearUserProfile()
    vi.restoreAllMocks()
  })

  it('should call user.syncProfile and return updated profile with cloud fields', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({
      openid: 'mock_openid',
      nickname: '小呱手作人',
      avatar_url: 'https://example.com/avatar.png',
      vip_level: 'pro',
      pattern_count: 5
    })

    const localProfile: UserProfile = {
      isLoggedIn: true,
      nickName: '小呱手作人',
      avatarUrl: 'https://example.com/avatar.png'
    }

    const merged = await syncUserWithCloud(localProfile)
    expect(merged.patternCount).toBe(5)
    expect(merged.vipLevel).toBe('pro')
    expect(merged.openid).toBe('mock_openid')

    // Verify persisted in storage
    const stored = getUserProfile()
    expect(stored.patternCount).toBe(5)
    expect(stored.vipLevel).toBe('pro')
    expect(stored.openid).toBe('mock_openid')
  })

  it('should fallback gracefully when cloud call fails', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockRejectedValue(new Error('Network error'))

    const localProfile: UserProfile = {
      isLoggedIn: true,
      nickName: '小呱访客',
      avatarUrl: ''
    }

    const merged = await syncUserWithCloud(localProfile)
    expect(merged.isLoggedIn).toBe(true)
    expect(merged.nickName).toBe('小呱访客')
  })

  it('should return original profile when cloudData is null', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue(null)

    const localProfile: UserProfile = {
      isLoggedIn: true,
      nickName: '小呱手作人',
      avatarUrl: 'https://example.com/avatar.png'
    }

    const merged = await syncUserWithCloud(localProfile)
    expect(merged).toEqual(localProfile)
  })
})
