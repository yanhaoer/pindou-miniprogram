import { describe, it, expect, beforeEach } from 'vitest'
import {
  getUserProfile,
  saveUserProfile,
  clearUserProfile,
  DEFAULT_GUEST_PROFILE
} from '@/utils/user'

describe('User Profile Storage Module', () => {
  beforeEach(() => {
    clearUserProfile()
  })

  it('returns default guest profile when no storage exists', () => {
    const profile = getUserProfile()
    expect(profile.isLoggedIn).toBe(false)
    expect(profile.nickName).toBe(DEFAULT_GUEST_PROFILE.nickName)
    expect(profile.avatarUrl).toBe('')
  })

  it('saves and retrieves updated user profile', () => {
    const updated = saveUserProfile({
      isLoggedIn: true,
      nickName: '可可爱爱呱呱',
      avatarUrl: 'https://example.com/avatar.png'
    })

    expect(updated.isLoggedIn).toBe(true)
    expect(updated.nickName).toBe('可可爱爱呱呱')

    const stored = getUserProfile()
    expect(stored.isLoggedIn).toBe(true)
    expect(stored.nickName).toBe('可可爱爱呱呱')
    expect(stored.avatarUrl).toBe('https://example.com/avatar.png')
  })

  it('clears user profile and restores guest state', () => {
    saveUserProfile({ isLoggedIn: true, nickName: '测试用户' })
    clearUserProfile()
    const stored = getUserProfile()
    expect(stored.isLoggedIn).toBe(false)
    expect(stored.nickName).toBe(DEFAULT_GUEST_PROFILE.nickName)
    expect(stored.avatarUrl).toBe('')
  })
})
