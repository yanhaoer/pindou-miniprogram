# 拼豆小程序：微信云开发聚合后端架构与数据设计规范

## 1. 概述与背景

随着小呱拼豆小程序（`pindou-miniprogram`）完成画板编辑器、图像量化、色系切换、1:1 对位导出与本地微信登录等核心交互，需要引入云端后端能力，实现用户多端数据同步、制作图纸草稿箱持久化、灵感广场社区分享、点赞互动与一键导入制作（二次创作）。

本规范确立了基于 **微信小程序云开发（WeChat CloudBase）单一聚合分发架构 (`cloudfunctions/api`)** 的后端体系。它免除了自建服务器与备案域名的繁琐流程，原生利用微信环境安全鉴权（自动获取 `OPENID`），并兼顾内容安全合规审核与低冷启动延迟。

---

## 2. 架构设计与工程组织

### 2.1 方案选型与聚合分发机制
采用**单一聚合分发云函数架构（Controller Pattern）**：
* 所有的业务接口统一路由至 `cloudfunctions/api`；
* 请求体包含 `action` 字段指示目标业务方法，如 `user.syncProfile`、`pattern.saveDraft`、`plaza.publish`；
* 共享一套 `wx-server-sdk` 依赖与数据库连接池，极大减少微信云函数容器休眠后的冷启动时延；
* 便于统一实现微信内容安全审核中间件、全局鉴权与标准错误包装。

### 2.2 目录与文件结构

```text
pindou-miniprogram/
├── cloudfunctions/
│   └── api/                         # 聚合主云函数
│       ├── package.json             # 依赖管理 (wx-server-sdk)
│       ├── index.js                 # 云函数主入口与 action 路由网关
│       ├── config.js                # 环境配置与全局常量
│       ├── controllers/             # 业务领域分层控制器
│       │   ├── user.js              # 用户鉴权与个人画像同步
│       │   ├── pattern.js           # 图纸云端存取、草稿箱管理与删除
│       │   └── plaza.js             # 灵感广场发布、流式分页、点赞与二次创作
│       └── utils/
│           ├── response.js          # 统一 JSON 响应封装
│           └── security.js          # 微信内容安全审核 (msgSecCheck)
├── src/
│   └── utils/
│       └── cloud.ts                 # 前端 Taro.cloud.callFunction 统一封装
└── project.config.json              # 配置 "cloudfunctionRoot": "./cloudfunctions/"
```

---

## 3. 云数据库集合设计 (Database Collections)

数据库基于微信云开发文档数据库（MongoDB 风格），规划 4 个核心集合：

### 3.1 用户集合：`users`
记录微信用户画像与统计数据：
```ts
interface UserDocument {
  _id: string                 // 微信 OPENID（作为主键保证唯一性）
  nickname: string            // 微信昵称
  avatar_url: string          // 头像链接
  vip_level: 'guest' | 'pro'  // 身份等级（默认 'pro' 匠人版）
  pattern_count: number       // 创建的图纸总数
  created_at: Date            // 注册时间
  updated_at: Date            // 最近活跃时间
}
```

### 3.2 图纸与草稿箱集合：`patterns`
存储用户绘制的拼豆像素图纸与工程元数据：
```ts
interface PatternDocument {
  _id: string                 // 图纸唯一 ID (UUID)
  _openid: string             // 创建者微信 OPENID (系统自动注入)
  title: string               // 图纸名称
  width: number               // 画板宽度 (e.g. 16, 20, 29, 52)
  height: number              // 画板高度 (e.g. 16, 20, 29, 52)
  brand: 'artkal' | 'mard' | 'perler' // 选用的色号品牌
  grid_data: any              // 核心像素网格数据 (二维压缩数组或对象)
  color_summary: Record<string, number> // 用色统计简报 (如 { "A01": 25, "S12": 140 })
  preview_url: string         // 图纸预览图链接或 base64
  is_public: boolean          // 是否公开发布至广场 (默认 false)
  fork_from_id?: string       // 二次创作来源图纸 ID (若有)
  created_at: Date            // 创建时间
  updated_at: Date            // 更新时间
}
```

### 3.3 灵感广场集合：`plaza_posts`
面向社区公开发布的精选与展示图纸：
```ts
interface PlazaPostDocument {
  _id: string                 // 帖子 ID (UUID)
  pattern_id: string          // 关联图纸的 _id
  author_openid: string       // 作者 OPENID
  author_nickname: string     // 作者昵称（冗余字段提升列表查询速度）
  author_avatar: string       // 作者头像
  title: string               // 图纸展示标题
  tag: string                 // 分类标签 (全部/热门/复古游戏/可爱萌宠/美食小物)
  size_desc: string           // 尺寸文本 (如 "28×28")
  colors_count: number        // 消耗颜色种数
  preview_url: string         // 广场卡片缩略图
  like_count: number          // 点赞累计数 (原子自增)
  fork_count: number          // 被导入制作累计数 (原子自增)
  audit_status: 'approved' | 'rejected' | 'pending' // 微信安全审核状态
  created_at: Date            // 发布时间
}
```

### 3.4 点赞与互动集合：`likes`
记录用户点赞关系，支持高并发防重复与状态回显：
```ts
interface LikeDocument {
  _id: string                 // 复合主键: `${openid}_${post_id}`
  post_id: string             // 被点赞的帖子 ID
  user_openid: string         // 点赞人 OPENID
  created_at: Date            // 点赞时间戳
}
```

---

## 4. 接口 Actions 与业务流程规范

所有云请求统一以 `{ action: string, data: any }` 方式调用 `api` 云函数。

### 4.1 统一响应格式
```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```
* `code === 0`：操作成功；
* `code !== 0`：业务错误（如 `40001` 内容违规、`40401` 资源不存在、`40301` 无权操作）。

### 4.2 用户模块 (`user.*`)
* **`user.syncProfile`**
  * **入参**：`{ nickname?: string, avatar_url?: string }`
  * **逻辑**：从 `cloud.getWXContext().OPENID` 获取调用方身份，自动执行 upsert（存在即更新，无则新增），返回当前用户的完整档案与会员状态。
* **`user.getProfile`**
  * **入参**：`{}`
  * **逻辑**：拉取当前用户的最新资料及创建的图纸数量。

### 4.3 图纸草稿模块 (`pattern.*`)
* **`pattern.saveDraft`**
  * **入参**：
    ```ts
    {
      id?: string,
      title: string,
      width: number,
      height: number,
      brand: string,
      grid_data: any,
      color_summary: Record<string, number>,
      preview_url?: string,
      fork_from_id?: string
    }
    ```
  * **逻辑**：若传 `id` 且校验归属于当前用户则更新；若不传则插入新图纸并将用户的 `pattern_count` 自增 1。
* **`pattern.listMine`**
  * **入参**：`{ page?: number, pageSize?: number }`
  * **逻辑**：按 `updated_at` 倒序分页拉取当前用户的图纸列表。为了传输性能，字段筛选排除巨大的 `grid_data`，只返回元数据与用色统计。
* **`pattern.getDetail`**
  * **入参**：`{ id: string }`
  * **逻辑**：读取单张图纸全部完整数据（包含 `grid_data`），用于在编辑器画板中一键加载恢复。
* **`pattern.delete`**
  * **入参**：`{ id: string }`
  * **逻辑**：验证图纸的所有权为当前用户，从 `patterns` 集合中物理删除，同步更新对应用户的 `pattern_count`。

### 4.4 灵感广场模块 (`plaza.*`)
* **`plaza.publish`**
  * **入参**：`{ pattern_id: string, title: string, tag: string, preview_url: string, size_desc?: string, colors_count?: number }`
  * **安全审核前置**：调用 `cloud.openapi.security.msgSecCheck` 对文本内容做安全合规校验。若违规直接返回拦截错误。
  * **逻辑**：将对应 `patterns` 标记 `is_public: true`，在 `plaza_posts` 集合插入新展示卡片。
* **`plaza.list`**
  * **入参**：`{ category?: string, page?: number, pageSize?: number }`
  * **逻辑**：支持按分类筛选与分页；同时在云函数中批量查询当前用户在 `likes` 表的记录，为每个卡片返回 `hasLiked: boolean` 属性。
* **`plaza.toggleLike`**
  * **入参**：`{ post_id: string }`
  * **逻辑**：以 `${openid}_${post_id}` 为主键原子检查 `likes` 集合。若已点赞则删除并使帖子 `like_count` 减 1；未点赞则添加并使 `like_count` 加 1。返回 `{ liked: boolean, like_count: number }`。
* **`plaza.fork`**
  * **入参**：`{ post_id: string }`
  * **逻辑**：将该帖子的 `fork_count` 自增 1；读取原图纸完整 `grid_data`，在当前用户草稿箱克隆一份新图纸，返回克隆后的图纸 ID。

---

## 5. 前端集成封装设计 (`src/utils/cloud.ts`)

封装前端通用云开发客户端，具备以下能力：
1. **自动环境初始化**：按需单例初始化 `Taro.cloud.init`；
2. **免登录透传**：依托小程序底层，无需手动在 HTTP Header 传递 JWT，自动享受原生 OPENID 静默鉴权；
3. **友好异常捕获**：提供统一的 Toast 提示与 Promise 结果解包。

---

## 6. 测试与验证策略

1. **单元测试与控制器测试**：针对路由分发器及 controllers 编写 mock 测试（验证 OPENID 提取、参数校验与响应包装）；
2. **前端与云开发联调测试**：
   - 验证用户授权登录后资料成功同步到云端数据库；
   - 验证编辑器一键保存草稿并在“我的制作草稿箱”即时展示；
   - 验证广场列表加载、分类筛选、点赞原子状态翻转与导入制作流转。

