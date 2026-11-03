# 拼豆小程序：我的页面微信授权登录与个人资料获取设计规范

## 1. 概述与背景

用户希望在微信小程序的“我的”页面中，实现点击登录功能。用户点击登录后，通过微信官方标准能力获取用户的微信姓名（昵称）与头像，并在“我的”名片区高亮展示，同时支持退出登录与资料维护。

本规范定义了用户数据模型、登录授权弹窗组件、页面名片状态流转以及本地持久化方案。

---

## 2. 核心需求与交互目标

1. **微信官方标准授权**：
   - 适配微信最新规范，使用 `<Button openType="chooseAvatar">` 选择/同步微信头像；
   - 使用 `<Input type="nickname">` 获取并允许输入微信昵称；
   - 辅以 `Taro.login()` 获取登录凭证 `code`，满足完整登录链路闭环。
2. **“我的”名片状态流转**：
   - **未登录态**：名片展示默认卡通头像（带登录引导角标），主文字展示“点击登录”，点击名片任意区域均可唤起登录授权弹窗；
   - **已登录态**：名片展示微信真实头像（带精致光圈与裁剪）与微信昵称，徽章点亮“PRO 匠人版”，支持点击重新修改头像与昵称。
3. **退出登录与持久化**：
   - 用户信息保存在 `Taro.getStorageSync` / `setStorageSync` 本地持久缓存；
   - 功能菜单底部提供“退出登录”条目，支持二次确认后安全登出并重置为访客态。
4. **双主题美学适配**：
   - 无论是弹窗还是个人名片，均无缝适配暗夜深邃模式 (`theme-dark`) 与明亮素雅模式 (`theme-light`)。

---

## 3. 架构与模块设计

### 3.1 用户数据模型与工具库 (`src/utils/user.ts`)

```ts
export interface UserProfile {
  isLoggedIn: boolean
  nickName: string
  avatarUrl: string
  loginTime?: number
}
```

提供的核心 API：
- `DEFAULT_GUEST_PROFILE`: 默认未登录访客对象：
  ```ts
  {
    isLoggedIn: false,
    nickName: '小呱访客',
    avatarUrl: ''
  }
  ```
- `getUserProfile(): UserProfile`: 从 Storage 读取 `pindou_user_profile`，若无或异常则返回默认访客对象；
- `saveUserProfile(profile: Partial<UserProfile>): UserProfile`: 更新字段并写入 Storage，返回合并后的完整 Profile；
- `clearUserProfile(): void`: 清空 Storage 中的用户档案，恢复默认访客态；
- `performWechatLogin(): Promise<{ code: string } | null>`: 在小程序端安全调用 `Taro.login()`，获取登录 code，其他端安全兜底。

---

### 3.2 微信授权登录弹窗 (`src/components/LoginModal.tsx` & `.scss`)

#### Props 接口
```ts
export interface LoginModalProps {
  isOpen: boolean
  theme: 'dark' | 'light'
  initialProfile?: UserProfile
  onClose: () => void
  onSuccess: (profile: UserProfile) => void
}
```

#### 组件内部逻辑与结构
1. **遮罩与弹窗卡片容器**：
   - 支持淡入与弹起动效，点击蒙层或关闭按钮触发 `onClose`。
2. **头像选择器**：
   - 原生包装按钮 `<Button className="avatar-btn" openType="chooseAvatar" onChooseAvatar={handleChooseAvatar}>`；
   - 内部包含圆形当前头像预览，右下角带有高亮相机拍摄/相册图标 `📷`；
   - `handleChooseAvatar(e)`: 从 `e.detail.avatarUrl` 获取临时图片路径，回显并暂存。
3. **昵称输入框**：
   - 原生包装输入框 `<Input type="nickname" className="nickname-input" placeholder="请输入或选择微信昵称" value={nickName} onInput={...} onBlur={...} />`；
   - 微信客户端弹起键盘时自动展示微信昵称快捷选择条。
4. **提交与校验**：
   - 点击“保存并登录”按钮时，进行基本校验（若昵称为空或仍为默认字样，给予 Friendly Toast 提示）；
   - 校验通过后，调用 `saveUserProfile({ isLoggedIn: true, nickName, avatarUrl, loginTime: Date.now() })`；
   - 尝试触发 `performWechatLogin()` 记录微信凭据；
   - 触发 `onSuccess(updatedProfile)` 并关闭弹窗。

---

### 3.3 页面集成与名片重构 (`src/pages/home/index.tsx` & `.scss`)

1. **状态初始化**：
   - 页面载入时执行 `const [userProfile, setUserProfile] = useState<UserProfile>(getUserProfile)`；
   - 新增 `const [showLoginModal, setShowLoginModal] = useState<boolean>(false)`；
2. **名片区域条件渲染**：
   - 未登录时：
     - 头像使用默认插画，右下角展示带有 `+` 的登录提示徽标；
     - 标题行展示高亮按钮样式的“点击登录 / 微信授权”；
     - 副标题展示“登录以同步个人拼豆与定制偏好”；
     - 右侧徽章展示“游客模式”；
     - 绑定 `onClick={() => setShowLoginModal(true)}`。
   - 已登录时：
     - 头像展示用户选择的真实微信头像（若无则兜底插画）；
     - 标题行展示真实微信昵称；
     - 徽章高亮“PRO 匠人版”；
     - 副标题展示个性签名；
     - 点击名片支持重新唤起编辑弹窗。
3. **功能菜单列表扩充**：
   - 当 `userProfile.isLoggedIn` 为 `true` 时，在菜单最底部展示“退出登录”条目；
   - 点击调用 `Taro.showModal` 提示二次确认；
   - 确认退出后调用 `clearUserProfile()`，将 `userProfile` 刷回未登录态，并弹出提示。

---

## 4. 异常处理与边界场景

| 场景 | 行为 / 处理方案 |
| --- | --- |
| 用户拒绝选择头像或直接关闭选择器 | 保持当前已选或默认头像，不影响后续操作 |
| 键盘选择昵称时 `onBlur` 事件丢失 | 同时监听 `onInput` 与 `onBlur`，保证填入文本实时捕获 |
| 用户未填入任何有效昵称 | 提交时阻断并提示“请先输入或选择微信昵称” |
| H5 / 非微信小程序环境运行 | `openType="chooseAvatar"` 在 H5 降级为默认图片或常规文件上传；`performWechatLogin` 安全返回 null 不报错 |
| 退出登录 | 清理 Storage，重置页面 state，不删除用户的本地离线拼豆图纸 |

---

## 5. 测试与验证策略

1. **单元测试 (`tests/utils/user.test.ts`)**：
   - 验证 `getUserProfile()` 默认返回结构与初始未登录标识；
   - 验证 `saveUserProfile()` 正确合并字段并写入 Mock Storage；
   - 验证 `clearUserProfile()` 正确清除缓存并恢复默认值；
   - 验证数据读写异常时的安全容错。
2. **多端编译验证**：
   - `npm run build:weapp` 编译微信小程序产物；
   - `npm run build:h5` 编译 Web 产物，确保双端无类型与构建错误。
