# 拼豆小程序：我的页面微信授权登录与个人资料获取实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在“我的”页面提供点击登录功能，通过微信官方标准能力（`openType="chooseAvatar"` 与 `type="nickname"`）获取并持久化用户的微信头像与昵称，重构名片展示与退出登录闭环。

**Architecture:**
1. 在 `src/utils/user.ts` 中封装用户信息模型、默认访客态、`Taro.getStorageSync` / `setStorageSync` 持久化读写以及微信登录 `performWechatLogin`。
2. 在 `src/components/LoginModal.tsx` 及 `LoginModal.scss` 中实现符合暗夜/明亮双主题的优雅授权弹层，集成官方选择头像和昵称填入组件，并提供校验。
3. 在 `src/pages/home/index.tsx` 中集成登录态，重构 `user-profile-card` 为未登录态与已登录态切换，并在功能列表中提供退出登录二次确认。

**Tech Stack:** Taro 4.3 (React 18), TypeScript, SCSS, WeChat Mini Program Native Components (`Button open-type="chooseAvatar"`, `Input type="nickname"`), Vitest

## Global Constraints

- 不可破坏现有拼豆画板、量化算法、历史记录以及色号过滤等核心功能。
- 保证在微信小程序 Native 与 H5 环境均不报错（H5 端提供安全降级与模拟头像昵称）。
- 单测使用 `bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'` 运行验证。

---

### Task 1: 用户模型与持久化工具库 (`src/utils/user.ts`) 及单元测试

**Files:**
- Create: `src/utils/user.ts`
- Create: `tests/utils/user.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface UserProfile {
    isLoggedIn: boolean
    nickName: string
    avatarUrl: string
    loginTime?: number
  }

  export const DEFAULT_GUEST_PROFILE: UserProfile
  export function getUserProfile(): UserProfile
  export function saveUserProfile(profile: Partial<UserProfile>): UserProfile
  export function clearUserProfile(): void
  export function performWechatLogin(): Promise<{ code: string } | null>
  ```

- [x] **Step 1: 编写单元测试**

在 `tests/utils/user.test.ts` 中编写测试用例：
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  })
})
```

- [x] **Step 2: 运行测试验证失败**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/user.test.ts'`
预期：FAIL（找不到模块 `src/utils/user.ts`）

- [x] **Step 3: 编写 `src/utils/user.ts`**

```ts
export interface UserProfile {
  isLoggedIn: boolean
  nickName: string
  avatarUrl: string
  loginTime?: number
}

const STORAGE_KEY = 'pindou_user_profile'

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
```

- [x] **Step 4: 运行测试验证通过**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/user.test.ts'`
预期：PASS

---

### Task 2: 微信官方授权登录弹窗组件 (`src/components/LoginModal.tsx` & `.scss`)

**Files:**
- Create: `src/components/LoginModal.tsx`
- Create: `src/components/LoginModal.scss`
- Modify: `src/assets/xiaogua.png` (as default fallback)

**Interfaces:**
- Consumes: `UserProfile`, `saveUserProfile`, `performWechatLogin` from `@/utils/user`
- Produces:
  ```tsx
  export interface LoginModalProps {
    isOpen: boolean
    theme: 'dark' | 'light'
    initialProfile?: UserProfile
    onClose: () => void
    onSuccess: (profile: UserProfile) => void
  }
  export const LoginModal: React.FC<LoginModalProps>
  ```

- [x] **Step 1: 编写 `LoginModal.tsx`**

实现头像与昵称填写面板：
1. 头像选择：`<Button openType="chooseAvatar" onChooseAvatar={handleChooseAvatar} className="avatar-pick-btn">`，内嵌选中图片或默认兜底头像，外带相机微标。
2. 昵称填写：`<Input type="nickname" className="nickname-input" placeholder="请输入或选择微信昵称" value={nickName} onInput={...} onBlur={...} />`。
3. 提示与校验：未填昵称时给出友好轻提示。
4. 确认提交：调用 `saveUserProfile` 与 `performWechatLogin`，回调 `onSuccess`。

- [x] **Step 2: 编写 `LoginModal.scss`**

提供暗色与明亮模式样式：
1. 居中/底部圆角卡片，毛玻璃暗色背景与高斯模糊遮罩；
2. 头像按钮去除微信原生默认边框（`border: none; &::after { display: none; }`），圆环微投影；
3. 大号高饱和度渐变按钮“保存并登录”，按压微缩放动效；
4. 右上角简约关闭按键。

- [x] **Step 3: 运行全量单测确认无构建语法破坏**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：PASS

---

### Task 3: “我的”页面名片重构与登录/登出链路集成

**Files:**
- Modify: `src/pages/home/index.tsx`
- Modify: `src/pages/home/index.scss`

- [x] **Step 1: 在 `src/pages/home/index.tsx` 中引入用户状态与 `LoginModal`**

1. 引入 `getUserProfile`, `clearUserProfile`, `UserProfile` 与 `LoginModal`。
2. 增加状态：
   ```tsx
   const [userProfile, setUserProfile] = useState<UserProfile>(getUserProfile)
   const [showLoginModal, setShowLoginModal] = useState<boolean>(false)
   ```
3. 重构 `user-profile-card`：
   - 未登录态（`!userProfile.isLoggedIn`）：
     - 显示默认插画头像，右下角带有 `+` 登录角标；
     - 主文字显示“点击登录 / 微信授权”，副文字“登录以同步个人拼豆与定制偏好”；
     - 徽章展示“游客模式”；
     - 点击名片卡片任意位置：`onClick={() => setShowLoginModal(true)}`。
   - 已登录态（`userProfile.isLoggedIn`）：
     - 显示用户微信头像 `userProfile.avatarUrl`；
     - 主文字展示真实昵称 `userProfile.nickName`；
     - 徽章展示“PRO 匠人版”；
     - 点击名片可唤起再次编辑。
4. 在菜单列表末尾添加“退出登录”：
   - 仅在 `userProfile.isLoggedIn` 为真时显示；
   - 点击时调用 `Taro.showModal` 确认后执行 `clearUserProfile()` 并同步页面状态。

- [x] **Step 2: 更新 `src/pages/home/index.scss` 样式**

1. 增强未登录与已登录名片差异化视觉：
   - 未登录时名片有呼吸微渐变边框，增加点击手感；
   - 已登录头像带有细微蓝光晕。
2. 菜单退出登录项样式（淡红色退出图标与字体微调）。

- [x] **Step 3: 运行全量单测验证**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：PASS

---

### Task 4: 双端编译与功能完整性验证

- [x] **Step 1: 运行全量单元测试**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：10 个测试套件（含 user.test.ts）100% 全部通过。

- [x] **Step 2: 编译微信小程序版本**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npm run build:weapp'`
预期：Webpack 编译成功，输出至 `dist/`。

- [x] **Step 3: 编译 H5 Web 版本**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npm run build:h5'`
预期：输出至 `dist-h5/`，无任何类型或 JSX 错误。
