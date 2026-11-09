# 拼豆小程序：前端云端草稿箱、灵感广场与用户数据全链路集成设计规范

## 1. 概述与目标

在完成微信云开发后端（`cloudfunctions/api`）各控制器与前端客户端 SDK（`src/utils/cloud.ts`）的搭建后，本规范定义了前端各页面与组件接入云端能力的具体实现方案，实现：
1. **微信用户档案与云端静默同步**：登录/修改资料时自动同步云端，个人名片展示云端真实历史图纸总数；
2. **编辑器云端草稿双向载入**：在编辑页面提供“保存至云端草稿”能力；支持携带 `patternId` 一键还原历史或克隆图纸至画板；
3. **“我的制作草稿箱”半屏抽屉组件 (`DraftsSheet`)**：主页点击草稿箱滑出半屏抽屉，展示云端草稿列表，支持载入编辑、删除草稿与发布到广场；
4. **灵感广场动态化与社区互动闭环**：替换主页广场静态数据为云端真实列表，支持分类筛选、点赞（乐观响应）与一键克隆制作（Fork）。

---

## 2. 页面与组件结构

```text
src/
├── components/
│   ├── DraftsSheet.tsx              # 我的制作草稿箱半屏抽屉组件
│   ├── DraftsSheet.scss             # 草稿抽屉样式（深浅双主题适配）
│   ├── PublishModal.tsx             # 发布图纸至广场配置弹窗
│   ├── PublishModal.scss            # 发布弹窗样式
│   └── LoginModal.tsx               # 增强：登录成功后调用 user.syncProfile
├── pages/
│   ├── home/
│   │   ├── index.tsx                # 接入草稿抽屉、广场动态列表、点赞与导入制作
│   │   └── index.scss               # 广场卡片与按钮样式微调
│   └── index/
│       ├── index.tsx                # 接入保存草稿、通过 patternId 恢复画板
│       └── index.scss               # 底部双操作按钮布局（保存草稿 + 下载图纸）
└── utils/
    ├── cloud.ts                     # 已就绪的云函数调用封装
    └── user.ts                      # 用户资料管理工具
```

---

## 3. 详细设计与交互流程

### 3.1 用户模块集成 (`LoginModal.tsx` & `home/index.tsx`)
1. **授权同步**：在 `LoginModal.tsx` 点击“保存并登录”且本地成功存储后，异步调用 `callCloudFunction('user.syncProfile', { nickname, avatar_url })`；
2. **数据回填**：云函数返回最新的 `{ openid, vip_level, pattern_count }`，前端合并更新本地 `UserProfile`，并触发状态刷新；
3. **主页数据展示**：主页 `stats-dashboard` 中，“历史图纸”数字优先读取云端 `pattern_count`，直观呈现用户作品沉淀。

---

### 3.2 编辑器云端保存与草稿恢复 (`src/pages/index/index.tsx`)

#### 1. 底部操作区升级 (Dual Action Card)
将原本单一的“下载高清施工图纸”按钮区改造为并排/双胶囊布局：
* **`☁️ 保存云端草稿`**（渐变主行动按钮）：
  * 点击时触发 `handleSaveDraft()`；
  * 若未登录，可安全自动生成并保存；
  * 数据构造：
    ```ts
    const patternPayload = {
      id: currentPatternId || undefined,
      title: currentPatternTitle || '未命名拼豆图纸',
      width: boardWidth,
      height: boardHeight,
      brand: currentBrand,
      grid_data: grid.map(row => row.map(cell => (cell ? { code: cell.color.code, hex: cell.color.hex } : null))),
      color_summary: Object.fromEntries(Array.from(colorStats.entries()).map(([k, v]) => [k, v.count])),
      preview_url: '' // 可选缩略图
    }
    ```
  * 调用 `callCloudFunction('pattern.saveDraft', patternPayload)`；
  * 保存成功后更新 `currentPatternId = res.id`，弹出 Toast 提示“已保存至云端草稿箱”。
* **`📥 下载施工图纸`**：保持原有的 1:1 对位打印图纸导出功能。

#### 2. 参数载入恢复画板 (`useLoad` / `useRouter`)
* 编辑器启动时检测路由参数 `router.params.patternId`；
* 若存在 `patternId`，显示加载中 Loading，调用 `callCloudFunction('pattern.getDetail', { id: patternId })`；
* 获取云端数据后：
  1. 设置画板规格：`setBoardWidth(pattern.width)`, `setBoardHeight(pattern.height)`；
  2. 切换品牌：`setCurrentBrand(pattern.brand)`；
  3. 还原网格：根据 `pattern.grid_data` 中的色号与色系，重建 `BeadCell[][]` 网格并刷新历史记录；
  4. 重新计算并呈现用色清单 `colorStats`。

---

### 3.3 “我的制作草稿箱”半屏抽屉组件 (`DraftsSheet.tsx`)

#### 1. 组件 Props 与状态
```ts
export interface DraftsSheetProps {
  isOpen: boolean
  theme: 'dark' | 'light'
  onClose: () => void
  onSelectDraft: (patternId: string) => void
}
```

#### 2. 行为机制
1. **抽屉打开**：调用 `callCloudFunction('pattern.listMine', { page: 1, pageSize: 30 })` 拉取当前用户图纸列表；
2. **列表项展示**：
   * 标题、画板尺寸（如 `29×29`）、品牌标（`Artkal / Mard / Perler`）、更新日期（格式化为 `MM-DD HH:mm`）、总用色数；
   * 操作按钮区：
     * **“载入制作”**：点击调用 `onSelectDraft(draft._id)`，关闭抽屉并跳转进入编辑器；
     * **“发布广场”**：弹出发布弹窗，填写标题与标签分类后发布至广场；
     * **“删除”**：调用 `Taro.showModal` 二次确认后调用 `pattern.delete`，成功后从本地列表实时剔除。

---

### 3.4 灵感广场动态加载、点赞与二次创作 (`tab-plaza-content`)

#### 1. 动态加载与流式刷新
* 切换至广场 Tab 或点击顶部标签（`全部`、`热门`、`复古游戏`、`可爱萌宠`、`美食小物`）时，重置列表并调用 `callCloudFunction('plaza.list', { category: plazaCategory })`；
* 若列表为空展示友好空状态插画。

#### 2. 乐观点赞互动 (Optimistic Like)
* 点击卡片上的 ❤️ 点赞按钮时，阻止事件冒泡；
* 立即在本地翻转该项的 `hasLiked` 状态，并将 `like_count` +1（或 -1）；
* 异步触发 `callCloudFunction('plaza.toggleLike', { post_id: item._id })`；
* 若网络失败或报错，回滚为操作前的点赞状态并给予 Toast 提示。

#### 3. 一键导入制作 (Fork / 二次创作)
* 点击卡片上的“导入制作”按钮；
* 显示全局加载 Loading（“正在克隆图纸...”）；
* 调用 `callCloudFunction('plaza.fork', { post_id: item._id })`；
* 成功后获取 `res.new_pattern_id`，直接跳转 `Taro.navigateTo({ url: `/pages/index/index?patternId=${res.new_pattern_id}` })` 打开编辑器。

---

## 4. 容错与异常处理策略

1. **未部署云环境/本地开发保护**：若在纯 H5 或未初始化云开发的环境下调用，捕获异常并给予降级提示，不阻塞本地绘图与离线保存；
2. **安全风控拦截提示**：发布到广场时若触发微信敏感词检测（错误码 `40001`），自动弹出“包含不合规字符，请修改标题后再发布”的精确指引。

---

## 5. 测试与验证方案

1. **组件单元测试**：针对 `DraftsSheet` 编写测试，验证拉取列表、空状态展示、点击载入及删除逻辑；
2. **状态联动测试**：验证乐观点赞在网络成功与失败时的计数流转；
3. **集成回归测试**：确保原有 16 个测试套件（126 个测试）完全不受影响。

