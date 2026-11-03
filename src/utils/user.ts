/**
 * User Profile and Storage Management for Pindou Miniprogram
 */

export interface UserProfile {
  isLoggedIn: boolean
  nickName: string
  avatarUrl: string
  loginTime?: number
}

const STORAGE_KEY = 'pindou_user_profile'
let memoryStorage: Record<string, any> = {}

export const DEFAULT_GUEST_PROFILE: UserProfile = {
  isLoggedIn: false,
  nickName: '小呱访客',
  avatarUrl: ''
}

export function getUserProfile(): UserProfile {
  try {
    const taro = (globalThis as any).Taro || (typeof window !== 'undefined' ? (window as any).Taro : null)
    let raw: string | UserProfile | null = null
    if (taro && typeof taro.getStorageSync === 'function') {
      raw = taro.getStorageSync(STORAGE_KEY)
    } else if (typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(STORAGE_KEY)
    } else {
      raw = memoryStorage[STORAGE_KEY] || null
    }

    if (!raw) return { ...DEFAULT_GUEST_PROFILE }
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object') {
      return {
        isLoggedIn: Boolean(parsed.isLoggedIn),
        nickName: parsed.nickName || DEFAULT_GUEST_PROFILE.nickName,
        avatarUrl: parsed.avatarUrl || '',
        loginTime: parsed.loginTime
      }
    }
  } catch (err) {
    console.warn('Failed to read user profile from storage', err)
  }
  return { ...DEFAULT_GUEST_PROFILE }
}

export function saveUserProfile(profile: Partial<UserProfile>): UserProfile {
  const current = getUserProfile()
  const merged: UserProfile = {
    ...current,
    ...profile,
    isLoggedIn: profile.isLoggedIn !== undefined ? profile.isLoggedIn : true,
    loginTime: profile.loginTime || Date.now()
  }

  try {
    const taro = (globalThis as any).Taro || (typeof window !== 'undefined' ? (window as any).Taro : null)
    if (taro && typeof taro.setStorageSync === 'function') {
      taro.setStorageSync(STORAGE_KEY, merged)
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    } else {
      memoryStorage[STORAGE_KEY] = JSON.stringify(merged)
    }
  } catch (err) {
    console.warn('Failed to save user profile to storage', err)
  }

  return merged
}

export function clearUserProfile(): void {
  try {
    const taro = (globalThis as any).Taro || (typeof window !== 'undefined' ? (window as any).Taro : null)
    if (taro && typeof taro.removeStorageSync === 'function') {
      taro.removeStorageSync(STORAGE_KEY)
    } else if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    delete memoryStorage[STORAGE_KEY]
  } catch (err) {
    console.warn('Failed to clear user profile from storage', err)
  }
}

export async function performWechatLogin(): Promise<{ code: string } | null> {
  const taro = (globalThis as any).Taro || (typeof window !== 'undefined' ? (window as any).Taro : null)
  if (taro && typeof taro.login === 'function') {
    return new Promise((resolve) => {
      taro.login({
        success: (res: any) => {
          if (res && res.code) {
            resolve({ code: res.code })
          } else {
            resolve(null)
          }
        },
        fail: () => resolve(null)
      })
    })
  }
  return null
}
