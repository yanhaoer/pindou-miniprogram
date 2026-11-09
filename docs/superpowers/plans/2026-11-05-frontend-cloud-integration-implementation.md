# 前端云端草稿箱、灵感广场与用户数据接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将微信云开发后端完整集成到小程序前端页面中，实现用户登录云同步、编辑器保存/还原草稿、半屏草稿箱抽屉管理，以及灵感广场动态加载、点赞与一键二次创作。

**Architecture:** 基于已封装的 `callCloudFunction` SDK，通过 React hooks 与组件化（`DraftsSheet`、`PublishModal`）解耦各业务模块，采用乐观更新与渐进增强提升用户体验。

**Tech Stack:** Taro React 18, TypeScript, SCSS, Vitest (v1.6+).

## Global Constraints

- 保持双主题（`theme-dark` / `theme-light`）UI 风格统一。
- 在无云环境或离线时具备安全降级与友好提示，不得产生白屏或崩溃。
- 测试命令统一使用：`export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run`。

---

### Task 1: 用户登录与云端档案数据同步

**Files:**
- Modify: `src/utils/user.ts`
- Modify: `src/components/LoginModal.tsx`
- Test: `tests/utils/user-sync.test.ts`

**Interfaces:**
- Produces: `syncUserWithCloud(profile: UserProfile): Promise<UserProfile>` in `src/utils/user.ts`

- [ ] **Step 1: 编写用户同步测试**

```ts
// tests/utils/user-sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncUserWithCloud, UserProfile } from '../../src/utils/user'
import * as cloud from '../../src/utils/cloud'

describe('User Cloud Sync', () => {
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
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/utils/user-sync.test.ts`
Expected: FAIL (syncUserWithCloud not defined)

- [ ] **Step 3: 实现 `syncUserWithCloud` 与 `LoginModal` 集成**

在 `src/utils/user.ts` 扩展 `UserProfile` 接口与实现 `syncUserWithCloud`：
```ts
export interface UserProfile {
  isLoggedIn: boolean
  nickName: string
  avatarUrl: string
  loginTime?: number
  openid?: string
  patternCount?: number
  vipLevel?: string
}

export async function syncUserWithCloud(profile: UserProfile): Promise<UserProfile> {
  try {
    const { callCloudFunction } = await import('./cloud')
    const cloudData = await callCloudFunction('user.syncProfile', {
      nickname: profile.nickName,
      avatar_url: profile.avatarUrl
    })
    if (cloudData) {
      return saveUserProfile({
        ...profile,
        openid: cloudData.openid,
        patternCount: cloudData.pattern_count,
        vipLevel: cloudData.vip_level
      })
    }
  } catch (err) {
    console.warn('[UserSync] Failed to sync with cloud:', err)
  }
  return profile
}
```

在 `src/components/LoginModal.tsx` 中，在成功登录保存本地后，异步调用 `syncUserWithCloud`。

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/utils/user-sync.test.ts`
Expected: PASS

---

### Task 2: 编辑器端云端草稿保存与参数恢复

**Files:**
- Modify: `src/pages/index/index.tsx`
- Modify: `src/pages/index/index.scss`
- Test: `tests/editor/draft-integration.test.ts`

**Interfaces:**
- Produces: `saveCurrentDraft()` in editor
- Produces: `restoreDraftFromId(patternId: string)` in editor

- [ ] **Step 1: 编写草稿提取与序列化工具测试**

```ts
// tests/editor/draft-integration.test.ts
import { describe, it, expect } from 'vitest'
import { serializeGridForDraft, deserializeGridFromDraft } from '../../src/utils/draft-helpers'

describe('Draft Serialization Helpers', () => {
  it('should serialize 2D bead grid into compact color objects', () => {
    const grid: any = [
      [{ color: { code: 'A01', hex: '#FF0000', name: '红' } }, null],
      [null, { color: { code: 'A02', hex: '#00FF00', name: '绿' } }]
    ]
    const serialized = serializeGridForDraft(grid)
    expect(serialized).toEqual([
      [{ code: 'A01', hex: '#FF0000' }, null],
      [null, { code: 'A02', hex: '#00FF00' }]
    ])
  })

  it('should deserialize compact draft grid into BeadCell objects', () => {
    const serialized = [
      [{ code: 'A01', hex: '#FF0000' }, null]
    ]
    const restored = deserializeGridFromDraft(serialized, 'artkal')
    expect(restored[0][0]?.color.code).toBe('A01')
    expect(restored[0][1]).toBeNull()
  })
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/editor/draft-integration.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/utils/draft-helpers.ts` 并集成进 `src/pages/index/index.tsx`**

实现 `src/utils/draft-helpers.ts`：
```ts
import { getPalette } from '@/palettes'
import type { BeadBrand, BeadColor } from '@/palettes/types'
import type { BeadCell } from '@/utils/quantizer'

export function serializeGridForDraft(grid: (BeadCell | null)[][]): any {
  return grid.map(row =>
    row.map(cell => (cell ? { code: cell.color.code, hex: cell.color.hex } : null))
  )
}

export function deserializeGridFromDraft(
  gridData: any,
  brand: BeadBrand
): (BeadCell | null)[][] {
  if (!Array.isArray(gridData)) return []
  const palette = getPalette(brand)
  const colorMap = new Map<string, BeadColor>()
  palette.colors.forEach(c => colorMap.set(c.code, c))

  return gridData.map((row, y) => {
    if (!Array.isArray(row)) return []
    return row.map((cell, x) => {
      if (!cell || !cell.code) return null
      const fullColor = colorMap.get(cell.code) || {
        code: cell.code,
        name: cell.code,
        hex: cell.hex || '#000000',
        rgb: [0, 0, 0] as [number, number, number]
      }
      return {
        color: fullColor,
        coord: { x, y }
      }
    })
  })
}
```

在 `src/pages/index/index.tsx` 中：
1. 底部操作区改为双操作按钮：`☁️ 保存云端草稿` 与 `📥 下载施工图纸`；
2. 绑定 `handleSaveDraft()`，调用 `callCloudFunction('pattern.saveDraft', ...)`；
3. 在 `useLoad` / `useEffect` 中，检查 `router.params.patternId`，拉取并用 `deserializeGridFromDraft` 还原画板。

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/editor/draft-integration.test.ts`
Expected: PASS

---

### Task 3: “我的制作草稿箱”半屏抽屉组件 (`DraftsSheet`) 与发布弹窗 (`PublishModal`)

**Files:**
- Create: `src/components/DraftsSheet.tsx`
- Create: `src/components/DraftsSheet.scss`
- Create: `src/components/PublishModal.tsx`
- Create: `src/components/PublishModal.scss`
- Test: `tests/components/DraftsSheet.test.ts`

**Interfaces:**
- Produces: `<DraftsSheet isOpen={...} onClose={...} onSelectDraft={...} onPublishSuccess={...} />`
- Produces: `<PublishModal isOpen={...} draft={...} onClose={...} onSuccess={...} />`

- [ ] **Step 1: 编写草稿箱抽屉组件逻辑测试**

```ts
// tests/components/DraftsSheet.test.ts
import { describe, it, expect, vi } from 'vitest'
import * as cloud from '../../src/utils/cloud'

describe('DraftsSheet Data Logic', () => {
  it('should fetch mine patterns list', async () => {
    const mockList = [
      { _id: 'd1', title: '马里奥', width: 29, height: 29, brand: 'artkal', updated_at: new Date() }
    ]
    vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({ list: mockList })

    const res = await cloud.callCloudFunction('pattern.listMine', { page: 1, pageSize: 30 })
    expect(res.list.length).toBe(1)
    expect(res.list[0].title).toBe('马里奥')
  })
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/components/DraftsSheet.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `DraftsSheet` 与 `PublishModal` 组件**

1. 实现 `DraftsSheet.tsx`：
   - 半屏滑起抽屉；
   - 打开时自动拉取 `pattern.listMine`；
   - 展示图纸卡片、尺寸、用色、品牌与更新时间；
   - 支持“载入制作”、“发布广场”、“删除（二次确认）”。
2. 实现 `PublishModal.tsx`：
   - 填写标题与分类标签（复古游戏、可爱萌宠等）；
   - 点击提交调用 `callCloudFunction('plaza.publish', ...)`，自动捕获安全风控 40001 提示。

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/components/DraftsSheet.test.ts`
Expected: PASS

---

### Task 4: 主页灵感广场真实数据、点赞与二次创作导入联动

**Files:**
- Modify: `src/pages/home/index.tsx`
- Modify: `src/pages/home/index.scss`
- Test: `tests/pages/plaza-integration.test.ts`

**Interfaces:**
- Produces: `fetchPlazaPosts(category?: string)`
- Produces: `handleToggleLike(postId: string)`
- Produces: `handleForkPattern(postId: string)`

- [ ] **Step 1: 编写广场交互逻辑测试**

```ts
// tests/pages/plaza-integration.test.ts
import { describe, it, expect, vi } from 'vitest'
import * as cloud from '../../src/utils/cloud'

describe('Plaza Client Integration Logic', () => {
  it('should fetch plaza items for category', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({
      list: [{ _id: 'post_1', title: '皮卡丘', like_count: 10, hasLiked: false }]
    })

    const res = await cloud.callCloudFunction('plaza.list', { category: '热门' })
    expect(res.list[0].title).toBe('皮卡丘')
  })

  it('should toggle like and return updated status', async () => {
    vi.spyOn(cloud, 'callCloudFunction').mockResolvedValue({
      liked: true,
      post_id: 'post_1'
    })

    const res = await cloud.callCloudFunction('plaza.toggleLike', { post_id: 'post_1' })
    expect(res.liked).toBe(true)
  })
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/pages/plaza-integration.test.ts`
Expected: FAIL

- [ ] **Step 3: 在 `src/pages/home/index.tsx` 中集成广场与草稿箱**

1. 将静态 `PLAZA_ITEMS` 替换为响应式 `plazaPosts` 状态；
2. 切换分类或加载页面时调用 `callCloudFunction('plaza.list', { category })`；
3. 绑定点赞点击，实行乐观更新（立即切换高亮与数字增减，失败回滚）；
4. 绑定“导入制作”，调用 `callCloudFunction('plaza.fork', { post_id })`，成功后获取新 ID 并跳转编辑器；
5. 点击“我的制作草稿箱”，打开 `DraftsSheet` 抽屉。

- [ ] **Step 4: 运行全部测试验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run`
Expected: All test suites PASS.

