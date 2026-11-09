# 拼豆小程序微信云开发聚合后端实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建拼豆小程序的微信云开发单一聚合后端 (`cloudfunctions/api`) 与前端调用层 (`src/utils/cloud.ts`)，实现用户身份同步、图纸云端草稿箱、灵感广场分享/点赞/二次创作以及微信内容安全审查。

**Architecture:** 单一聚合云函数架构 (Controller Pattern)，通过 `action` 路由分发器调度各业务模块 (`user`, `pattern`, `plaza`)，使用 `wx-server-sdk` 与微信云数据库文档模型交互，提供统一响应与微信安全过滤。

**Tech Stack:** Node.js (CommonJS for CloudFunctions), `wx-server-sdk`, TypeScript, Taro React 18, Vitest (v1.6+).

## Global Constraints

- 微信云函数环境运行 Node.js CommonJS 模块规范。
- 业务请求体必须具备 `{ action: string, data?: any }` 结构。
- 响应统一为 `{ code: number, message: string, data: any }`，`code === 0` 代表成功。
- 用户标识统一通过 `cloud.getWXContext().OPENID` 获取，禁止客户端伪造。
- 测试执行命令统一使用：`export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run`。

---

### Task 1: 基础设施配置、标准响应包装与环境配置

**Files:**
- Create: `cloudfunctions/api/package.json`
- Create: `cloudfunctions/api/config.js`
- Create: `cloudfunctions/api/utils/response.js`
- Modify: `project.config.json`
- Test: `tests/backend/response.test.ts`

**Interfaces:**
- Produces: `successResponse(data: any, message?: string): { code: 0, message: string, data: any }`
- Produces: `errorResponse(message: string, code?: number, data?: any): { code: number, message: string, data: any }`

- [ ] **Step 1: 编写标准响应工具测试**

```ts
// tests/backend/response.test.ts
import { describe, it, expect } from 'vitest'
const { successResponse, errorResponse } = require('../../cloudfunctions/api/utils/response')

describe('Cloud Function Response Utils', () => {
  it('should format success response correctly', () => {
    const res = successResponse({ id: '123' }, 'created')
    expect(res).toEqual({
      code: 0,
      message: 'created',
      data: { id: '123' }
    })
  })

  it('should default message to success', () => {
    const res = successResponse()
    expect(res).toEqual({
      code: 0,
      message: 'success',
      data: null
    })
  })

  it('should format error response with custom code', () => {
    const err = errorResponse('Invalid parameters', 40001, { field: 'title' })
    expect(err).toEqual({
      code: 40001,
      message: 'Invalid parameters',
      data: { field: 'title' }
    })
  })
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/response.test.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: 实现配置与标准响应工具**

在 `cloudfunctions/api/package.json` 中配置基础元数据：
```json
{
  "name": "pindou-cloud-api",
  "version": "1.0.0",
  "description": "Pindou Miniprogram Cloud Functions API",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

在 `cloudfunctions/api/config.js` 中编写配置：
```js
module.exports = {
  COLLECTIONS: {
    USERS: 'users',
    PATTERNS: 'patterns',
    PLAZA_POSTS: 'plaza_posts',
    LIKES: 'likes'
  },
  DEFAULT_PAGE_SIZE: 15,
  MAX_PAGE_SIZE: 50
}
```

在 `cloudfunctions/api/utils/response.js` 中编写响应封装：
```js
function successResponse(data = null, message = 'success') {
  return {
    code: 0,
    message,
    data
  }
}

function errorResponse(message = 'fail', code = -1, data = null) {
  return {
    code,
    message,
    data
  }
}

module.exports = {
  successResponse,
  errorResponse
}
```

并在 `project.config.json` 顶层增加 `"cloudfunctionRoot": "./cloudfunctions/"`。

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/response.test.ts`
Expected: PASS

---

### Task 2: 聚合网关入口与 Action 路由分发器

**Files:**
- Create: `cloudfunctions/api/index.js`
- Test: `tests/backend/router.test.ts`

**Interfaces:**
- Consumes: `response.js`
- Produces: `main(event: { action: string, data?: any }, context: any): Promise<Response>`

- [ ] **Step 1: 编写路由网关测试**

```ts
// tests/backend/router.test.ts
import { describe, it, expect, vi } from 'vitest'
const api = require('../../cloudfunctions/api/index')

describe('Cloud API Router Gateway', () => {
  it('should return 40000 when action is missing', async () => {
    const res = await api.main({}, {})
    expect(res.code).toBe(40000)
    expect(res.message).toContain('action is required')
  })

  it('should return 40400 when action is not recognized', async () => {
    const res = await api.main({ action: 'unknown.action' }, {})
    expect(res.code).toBe(40400)
    expect(res.message).toContain('Unknown action')
  })

  it('should dispatch to registered action handler with openid', async () => {
    const res = await api.main(
      { action: 'system.ping', data: { echo: 'hello' } },
      { OPENID: 'mock_openid_123' }
    )
    expect(res.code).toBe(0)
    expect(res.data.echo).toBe('hello')
    expect(res.data.openid).toBe('mock_openid_123')
  })
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/router.test.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: 实现 `cloudfunctions/api/index.js`**

```js
const { successResponse, errorResponse } = require('./utils/response')

let cloud = null
try {
  cloud = require('wx-server-sdk')
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
} catch (e) {
  // Mock fallback for test environment
}

const routes = {
  'system.ping': async (data, context) => {
    return successResponse({ echo: data && data.echo, openid: context.openid })
  }
}

function registerRoute(action, handler) {
  routes[action] = handler
}

async function main(event = {}, context = {}) {
  const { action, data = {} } = event
  if (!action || typeof action !== 'string') {
    return errorResponse('action is required and must be a string', 40000)
  }

  // 获取微信上下文 OPENID
  let wxContext = {}
  if (cloud && typeof cloud.getWXContext === 'function') {
    wxContext = cloud.getWXContext() || {}
  }
  const openid = wxContext.OPENID || context.OPENID || ''

  const handler = routes[action]
  if (!handler || typeof handler !== 'function') {
    return errorResponse(`Unknown action: ${action}`, 40400)
  }

  try {
    return await handler(data, { ...context, ...wxContext, openid, cloud })
  } catch (err) {
    console.error(`[API Error] action=${action}:`, err)
    return errorResponse(err.message || 'Internal server error', 50000)
  }
}

module.exports = {
  main,
  registerRoute,
  routes
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/router.test.ts`
Expected: PASS

---

### Task 3: 用户模块控制器 (`user.js`)

**Files:**
- Create: `cloudfunctions/api/controllers/user.js`
- Modify: `cloudfunctions/api/index.js` (注册 user 动作)
- Test: `tests/backend/user.test.ts`

**Interfaces:**
- Produces: `syncProfile(data: { nickname?: string, avatar_url?: string }, ctx: Context)`
- Produces: `getProfile(data: any, ctx: Context)`

- [ ] **Step 1: 编写用户控制器测试**

```ts
// tests/backend/user.test.ts
import { describe, it, expect } from 'vitest'
const userController = require('../../cloudfunctions/api/controllers/user')

describe('User Controller', () => {
  it('should reject unauthenticated request', async () => {
    const res = await userController.syncProfile({}, { openid: '' })
    expect(res.code).toBe(40100)
  })

  it('should upsert user document and return profile', async () => {
    const mockDb = {
      users: new Map(),
      collection(name: string) {
        return {
          doc: (id: string) => ({
            get: async () => {
              const u = mockDb.users.get(id)
              if (!u) throw new Error('Not found')
              return { data: u }
            },
            set: async ({ data }: any) => {
              mockDb.users.set(id, { _id: id, ...data })
              return { stats: { updated: 1 } }
            }
          })
        }
      }
    }

    const res = await userController.syncProfile(
      { nickname: '拼豆呱呱', avatar_url: 'https://example.com/avatar.png' },
      { openid: 'test_user_1', db: mockDb }
    )

    expect(res.code).toBe(0)
    expect(res.data.nickname).toBe('拼豆呱呱')
    expect(res.data.vip_level).toBe('pro')
    expect(res.data.pattern_count).toBe(0)
  })
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/user.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `cloudfunctions/api/controllers/user.js` 并注册**

```js
const { successResponse, errorResponse } = require('../utils/response')
const { COLLECTIONS } = require('../config')

async function syncProfile(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) {
    return errorResponse('User unauthorized: missing OPENID', 40100)
  }

  const db = injectedDb || (cloud && cloud.database())
  if (!db) {
    return errorResponse('Database connection not available', 50000)
  }

  const userRef = db.collection(COLLECTIONS.USERS).doc(openid)
  const now = new Date()

  let current = null
  try {
    const res = await userRef.get()
    current = res.data
  } catch (e) {
    // 首次注册无记录
  }

  const profileData = {
    nickname: data.nickname || (current && current.nickname) || '拼豆手作人',
    avatar_url: data.avatar_url || (current && current.avatar_url) || '',
    vip_level: (current && current.vip_level) || 'pro',
    pattern_count: (current && current.pattern_count) || 0,
    updated_at: now
  }

  if (!current) {
    profileData.created_at = now
  }

  await userRef.set({ data: profileData })

  return successResponse({
    openid,
    ...profileData
  })
}

async function getProfile(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) {
    return errorResponse('User unauthorized', 40100)
  }

  const db = injectedDb || (cloud && cloud.database())
  const userRef = db.collection(COLLECTIONS.USERS).doc(openid)

  try {
    const res = await userRef.get()
    return successResponse(res.data)
  } catch (err) {
    return syncProfile({}, ctx)
  }
}

module.exports = {
  syncProfile,
  getProfile
}
```

在 `cloudfunctions/api/index.js` 注册路由：
```js
const userController = require('./controllers/user')
routes['user.syncProfile'] = userController.syncProfile
routes['user.getProfile'] = userController.getProfile
```

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/user.test.ts`
Expected: PASS

---

### Task 4: 图纸草稿模块控制器 (`pattern.js`)

**Files:**
- Create: `cloudfunctions/api/controllers/pattern.js`
- Modify: `cloudfunctions/api/index.js` (注册 pattern 动作)
- Test: `tests/backend/pattern.test.ts`

**Interfaces:**
- Produces: `saveDraft(data: PatternData, ctx: Context)`
- Produces: `listMine(data: Pagination, ctx: Context)`
- Produces: `getDetail(data: { id: string }, ctx: Context)`
- Produces: `deleteDraft(data: { id: string }, ctx: Context)`

- [ ] **Step 1: 编写图纸控制器测试**

```ts
// tests/backend/pattern.test.ts
import { describe, it, expect } from 'vitest'
const patternController = require('../../cloudfunctions/api/controllers/pattern')

describe('Pattern Controller', () => {
  it('should validate required width and height', async () => {
    const res = await patternController.saveDraft({ title: '马里奥' }, { openid: 'u1' })
    expect(res.code).toBe(40002)
    expect(res.message).toContain('width and height are required')
  })

  it('should save new draft with generated ID and update user count', async () => {
    const store = new Map()
    let userUpdated = false
    const mockDb = {
      collection(name: string) {
        if (name === 'patterns') {
          return {
            add: async ({ data }: any) => {
              const id = 'pattern_uuid_1'
              store.set(id, { _id: id, ...data })
              return { _id: id }
            }
          }
        }
        if (name === 'users') {
          return {
            doc: () => ({
              update: async () => { userUpdated = true }
            })
          }
        }
      }
    }

    const res = await patternController.saveDraft({
      title: '皮卡丘挂件',
      width: 29,
      height: 29,
      brand: 'artkal',
      grid_data: [[1, 2], [3, 4]],
      color_summary: { A01: 4 }
    }, { openid: 'u1', db: mockDb })

    expect(res.code).toBe(0)
    expect(res.data.id).toBe('pattern_uuid_1')
    expect(userUpdated).toBe(true)
  })
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/pattern.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `cloudfunctions/api/controllers/pattern.js` 并注册**

```js
const { successResponse, errorResponse } = require('../utils/response')
const { COLLECTIONS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../config')

async function saveDraft(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)

  const { id, title = '未命名图纸', width, height, brand = 'artkal', grid_data, color_summary = {}, preview_url = '', fork_from_id } = data
  if (!width || !height) {
    return errorResponse('width and height are required', 40002)
  }

  const db = injectedDb || (cloud && cloud.database())
  const now = new Date()

  if (id) {
    // 更新既有图纸
    const ref = db.collection(COLLECTIONS.PATTERNS).doc(id)
    await ref.update({
      data: {
        title,
        width,
        height,
        brand,
        grid_data,
        color_summary,
        preview_url,
        updated_at: now
      }
    })
    return successResponse({ id, updated_at: now })
  }

  // 新增图纸
  const patternDoc = {
    _openid: openid,
    title,
    width,
    height,
    brand,
    grid_data,
    color_summary,
    preview_url,
    is_public: false,
    fork_from_id: fork_from_id || null,
    created_at: now,
    updated_at: now
  }

  const res = await db.collection(COLLECTIONS.PATTERNS).add({ data: patternDoc })
  const newId = res._id

  // 累加用户作品数
  try {
    const _ = db.command
    await db.collection(COLLECTIONS.USERS).doc(openid).update({
      data: _ && _.inc ? { pattern_count: _.inc(1) } : { pattern_count: 1 }
    })
  } catch (e) {}

  return successResponse({ id: newId, created_at: now })
}

async function listMine(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)

  const db = injectedDb || (cloud && cloud.database())
  const page = Math.max(1, Number(data.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(data.pageSize) || DEFAULT_PAGE_SIZE))
  const skip = (page - 1) * pageSize

  const res = await db.collection(COLLECTIONS.PATTERNS)
    .where({ _openid: openid })
    .field({ grid_data: false }) // 排除大矩阵，保障列表秒出
    .orderBy('updated_at', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  return successResponse({
    list: res.data || [],
    page,
    pageSize
  })
}

async function getDetail(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  const { id } = data
  if (!id) return errorResponse('id is required', 40003)

  const db = injectedDb || (cloud && cloud.database())
  const res = await db.collection(COLLECTIONS.PATTERNS).doc(id).get()
  return successResponse(res.data)
}

async function deleteDraft(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  const { id } = data
  if (!id) return errorResponse('id is required', 40003)

  const db = injectedDb || (cloud && cloud.database())
  await db.collection(COLLECTIONS.PATTERNS).doc(id).remove()
  return successResponse({ id, deleted: true })
}

module.exports = {
  saveDraft,
  listMine,
  getDetail,
  deleteDraft
}
```

在 `cloudfunctions/api/index.js` 注册路由：
```js
const patternController = require('./controllers/pattern')
routes['pattern.saveDraft'] = patternController.saveDraft
routes['pattern.listMine'] = patternController.listMine
routes['pattern.getDetail'] = patternController.getDetail
routes['pattern.delete'] = patternController.deleteDraft
```

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/pattern.test.ts`
Expected: PASS

---

### Task 5: 微信内容合规审核与灵感广场控制器 (`security.js` & `plaza.js`)

**Files:**
- Create: `cloudfunctions/api/utils/security.js`
- Create: `cloudfunctions/api/controllers/plaza.js`
- Modify: `cloudfunctions/api/index.js` (注册 plaza 动作)
- Test: `tests/backend/plaza.test.ts`

**Interfaces:**
- Produces: `checkText(content: string, cloud: any): Promise<{ pass: boolean, reason?: string }>`
- Produces: `publish(data: PublishData, ctx: Context)`
- Produces: `list(data: ListQuery, ctx: Context)`
- Produces: `toggleLike(data: { post_id: string }, ctx: Context)`
- Produces: `fork(data: { post_id: string }, ctx: Context)`

- [ ] **Step 1: 编写灵感广场与点赞互动测试**

```ts
// tests/backend/plaza.test.ts
import { describe, it, expect } from 'vitest'
const plazaController = require('../../cloudfunctions/api/controllers/plaza')

describe('Plaza Controller', () => {
  it('should intercept sensitive words when publishing', async () => {
    const mockSecurity = {
      checkText: async () => ({ pass: false, reason: '包含敏感内容' })
    }
    const res = await plazaController.publish(
      { title: '敏感词测试', tag: '热门' },
      { openid: 'u1', security: mockSecurity }
    )
    expect(res.code).toBe(40001)
    expect(res.message).toContain('包含敏感内容')
  })

  it('should toggle like idempotently', async () => {
    const likesMap = new Map()
    const postsMap = new Map([['p1', { _id: 'p1', like_count: 5 }]])

    const mockDb = {
      collection(col: string) {
        if (col === 'likes') {
          return {
            doc: (id: string) => ({
              get: async () => {
                const item = likesMap.get(id)
                if (!item) throw new Error('Not found')
                return { data: item }
              },
              set: async ({ data }: any) => { likesMap.set(id, data) },
              remove: async () => { likesMap.delete(id) }
            })
          }
        }
        if (col === 'plaza_posts') {
          return {
            doc: (id: string) => ({
              update: async ({ data }: any) => {
                const post = postsMap.get(id)
                post.like_count += data.like_count.$inc
              }
            })
          }
        }
      }
    }

    // 第一次点赞：like_count 应该增加
    const res1 = await plazaController.toggleLike({ post_id: 'p1' }, { openid: 'u1', db: mockDb })
    expect(res1.code).toBe(0)
    expect(res1.data.liked).toBe(true)

    // 第二次点赞：取消点赞
    const res2 = await plazaController.toggleLike({ post_id: 'p1' }, { openid: 'u1', db: mockDb })
    expect(res2.code).toBe(0)
    expect(res2.data.liked).toBe(false)
  })
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/plaza.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `security.js` 与 `plaza.js` 并注册**

在 `cloudfunctions/api/utils/security.js` 中：
```js
async function checkText(content, cloud) {
  if (!content || !cloud || !cloud.openapi || !cloud.openapi.security) {
    return { pass: true }
  }
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      content
    })
    if (res.errCode === 0) {
      return { pass: true }
    }
    return { pass: false, reason: '内容包含敏感或不合规信息' }
  } catch (err) {
    if (err.errCode === 87014) {
      return { pass: false, reason: '内容包含敏感或不合规信息' }
    }
    return { pass: true } // 网络故障兜底
  }
}

module.exports = {
  checkText
}
```

在 `cloudfunctions/api/controllers/plaza.js` 中：
```js
const { successResponse, errorResponse } = require('../utils/response')
const defaultSecurity = require('../utils/security')
const { COLLECTIONS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../config')

async function publish(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud, security = defaultSecurity } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)

  const { pattern_id, title = '', tag = '全部', preview_url = '', size_desc = '标准', colors_count = 0 } = data
  if (!title) return errorResponse('title is required', 40001)

  // 微信安全审核前置
  const secResult = await security.checkText(`${title} ${tag}`, cloud)
  if (!secResult.pass) {
    return errorResponse(secResult.reason || '内容存在不合规字符，请修改后重试', 40001)
  }

  const db = injectedDb || (cloud && cloud.database())
  const now = new Date()

  // 读取用户昵称与头像作为冗余字段
  let authorNickname = '手作达人'
  let authorAvatar = ''
  try {
    const user = await db.collection(COLLECTIONS.USERS).doc(openid).get()
    if (user && user.data) {
      authorNickname = user.data.nickname || authorNickname
      authorAvatar = user.data.avatar_url || ''
    }
  } catch (e) {}

  const postDoc = {
    pattern_id,
    author_openid: openid,
    author_nickname: authorNickname,
    author_avatar: authorAvatar,
    title,
    tag,
    size_desc,
    colors_count,
    preview_url,
    like_count: 0,
    fork_count: 0,
    audit_status: 'approved',
    created_at: now
  }

  const res = await db.collection(COLLECTIONS.PLAZA_POSTS).add({ data: postDoc })

  // 同步标记图纸为公开
  if (pattern_id) {
    try {
      await db.collection(COLLECTIONS.PATTERNS).doc(pattern_id).update({
        data: { is_public: true }
      })
    } catch (e) {}
  }

  return successResponse({ id: res._id, created_at: now })
}

async function list(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  const db = injectedDb || (cloud && cloud.database())
  const { category } = data
  const page = Math.max(1, Number(data.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(data.pageSize) || DEFAULT_PAGE_SIZE))
  const skip = (page - 1) * pageSize

  let query = db.collection(COLLECTIONS.PLAZA_POSTS)
  if (category && category !== '全部') {
    query = query.where({ tag: category })
  }

  const res = await query.orderBy('created_at', 'desc').skip(skip).limit(pageSize).get()
  const items = res.data || []

  // 批量补充 hasLiked 状态
  const listWithLikes = await Promise.all(items.map(async (item) => {
    let hasLiked = false
    if (openid) {
      try {
        const likeKey = `${openid}_${item._id}`
        const lk = await db.collection(COLLECTIONS.LIKES).doc(likeKey).get()
        if (lk && lk.data) hasLiked = true
      } catch (e) {}
    }
    return { ...item, hasLiked }
  }))

  return successResponse({
    list: listWithLikes,
    page,
    pageSize
  })
}

async function toggleLike(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)
  const { post_id } = data
  if (!post_id) return errorResponse('post_id is required', 40003)

  const db = injectedDb || (cloud && cloud.database())
  const likeKey = `${openid}_${post_id}`
  const likeRef = db.collection(COLLECTIONS.LIKES).doc(likeKey)

  let liked = false
  try {
    await likeRef.get()
    // 已点赞 -> 取消
    await likeRef.remove()
    await db.collection(COLLECTIONS.PLAZA_POSTS).doc(post_id).update({
      data: { like_count: { $inc: -1 } }
    })
    liked = false
  } catch (err) {
    // 未点赞 -> 新增点赞
    await likeRef.set({
      data: {
        post_id,
        user_openid: openid,
        created_at: new Date()
      }
    })
    await db.collection(COLLECTIONS.PLAZA_POSTS).doc(post_id).update({
      data: { like_count: { $inc: 1 } }
    })
    liked = true
  }

  return successResponse({ liked, post_id })
}

async function fork(data = {}, ctx = {}) {
  const { openid, db: injectedDb, cloud } = ctx
  if (!openid) return errorResponse('Unauthorized', 40100)
  const { post_id } = data
  if (!post_id) return errorResponse('post_id is required', 40003)

  const db = injectedDb || (cloud && cloud.database())
  const post = await db.collection(COLLECTIONS.PLAZA_POSTS).doc(post_id).get()
  const patternId = post.data && post.data.pattern_id

  if (!patternId) return errorResponse('Source pattern not found', 40401)

  const sourcePattern = await db.collection(COLLECTIONS.PATTERNS).doc(patternId).get()
  const source = sourcePattern.data

  // 累加帖子的 fork_count
  await db.collection(COLLECTIONS.PLAZA_POSTS).doc(post_id).update({
    data: { fork_count: { $inc: 1 } }
  })

  // 克隆到当前用户名下
  const newPattern = {
    ...source,
    _openid: openid,
    title: `${source.title} (副本)`,
    fork_from_id: patternId,
    is_public: false,
    created_at: new Date(),
    updated_at: new Date()
  }
  delete newPattern._id

  const addRes = await db.collection(COLLECTIONS.PATTERNS).add({ data: newPattern })
  return successResponse({
    new_pattern_id: addRes._id,
    pattern: newPattern
  })
}

module.exports = {
  publish,
  list,
  toggleLike,
  fork
}
```

在 `cloudfunctions/api/index.js` 注册路由：
```js
const plazaController = require('./controllers/plaza')
routes['plaza.publish'] = plazaController.publish
routes['plaza.list'] = plazaController.list
routes['plaza.toggleLike'] = plazaController.toggleLike
routes['plaza.fork'] = plazaController.fork
```

- [ ] **Step 4: 运行测试验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/backend/plaza.test.ts`
Expected: PASS

---

### Task 6: 前端云开发客户端 SDK (`src/utils/cloud.ts`)

**Files:**
- Create: `src/utils/cloud.ts`
- Test: `tests/utils/cloud.test.ts`

**Interfaces:**
- Produces: `callCloudFunction<T = any>(action: string, data?: any): Promise<T>`
- Produces: `initCloudOnce(): void`

- [ ] **Step 1: 编写前端云客户端 SDK 测试**

```ts
// tests/utils/cloud.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callCloudFunction, initCloudOnce } from '../../src/utils/cloud'

describe('Frontend Cloud SDK Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should call Taro.cloud.callFunction with standard action envelope', async () => {
    const mockCallFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        message: 'success',
        data: { openid: 'test_user_ok' }
      }
    })

    const mockTaro = {
      cloud: {
        init: vi.fn(),
        callFunction: mockCallFunction
      }
    }
    ;(globalThis as any).Taro = mockTaro

    initCloudOnce()
    expect(mockTaro.cloud.init).toHaveBeenCalled()

    const res = await callCloudFunction<{ openid: string }>('user.syncProfile', { nickname: '小呱' })
    expect(res.openid).toBe('test_user_ok')
    expect(mockCallFunction).toHaveBeenCalledWith({
      name: 'api',
      data: {
        action: 'user.syncProfile',
        data: { nickname: '小呱' }
      }
    })
  })

  it('should throw friendly error when cloud returns non-zero code', async () => {
    const mockTaro = {
      cloud: {
        init: vi.fn(),
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 40001,
            message: '包含敏感内容'
          }
        })
      },
      showToast: vi.fn()
    }
    ;(globalThis as any).Taro = mockTaro

    await expect(callCloudFunction('plaza.publish', { title: 'bad' })).rejects.toThrow('包含敏感内容')
    expect(mockTaro.showToast).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 验证测试失败**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run tests/utils/cloud.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/utils/cloud.ts`**

```ts
/**
 * WeChat CloudBase SDK Wrapper for Pindou Miniprogram
 */
import Taro from '@tarojs/taro'

let hasInitialized = false

export function initCloudOnce() {
  if (hasInitialized) return
  try {
    const taro = (globalThis as any).Taro || Taro
    if (taro && taro.cloud && typeof taro.cloud.init === 'function') {
      taro.cloud.init({
        traceUser: true
      })
      hasInitialized = true
    }
  } catch (err) {
    console.warn('[CloudBase] Initialization warning:', err)
  }
}

export interface CloudResponse<T = any> {
  code: number
  message: string
  data: T
}

export async function callCloudFunction<T = any>(
  action: string,
  data: Record<string, any> = {}
): Promise<T> {
  initCloudOnce()
  const taro = (globalThis as any).Taro || Taro

  if (!taro || !taro.cloud || typeof taro.cloud.callFunction !== 'function') {
    throw new Error('WeChat CloudBase environment is not available in current runtime')
  }

  try {
    const res = await taro.cloud.callFunction({
      name: 'api',
      data: {
        action,
        data
      }
    })

    const payload = res && (res.result as CloudResponse<T>)
    if (!payload) {
      throw new Error('Empty response from cloud function')
    }

    if (payload.code !== 0) {
      if (typeof taro.showToast === 'function') {
        taro.showToast({
          title: payload.message || '操作失败',
          icon: 'none'
        })
      }
      throw new Error(payload.message || `Cloud error code: ${payload.code}`)
    }

    return payload.data
  } catch (err: any) {
    console.error(`[Cloud Call Error] action=${action}:`, err)
    throw err
  }
}
```

- [ ] **Step 4: 运行全部测试套件验证通过**

Run: `export PATH="$HOME/.nvm/versions/node/v20.15.0/bin:$PATH" && npx vitest run`
Expected: All backend & frontend test suites PASS.

