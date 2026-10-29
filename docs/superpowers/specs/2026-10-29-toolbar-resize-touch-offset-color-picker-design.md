# 拼豆小程序：工具栏放大、触控偏移修复与全量色号选择抽屉设计规范

## 1. 目标与背景

本规范旨在解决用户在拼豆图纸编辑器中的三项关键交互体验问题：
1. **顶部工具栏（ToolBar）移动端触控优化**：按钮与图标偏小、手指点击不够舒适，放大并优化移动端触控区域；
2. **画板触控方块定位严重偏移修复**：彻底解决点击画板方块时由于没有扣除小程序导航栏与外边距导致的定位不准问题；
3. **全量色号底部抽屉选择器（FullColorPickerSheet）**：在画笔模式下，点击画板方块时滑出当前品牌的完整色号库抽屉，支持分类与即时搜索，选中后精准更新该方块色彩并同步为当前画笔色。

---

## 2. 详细设计与实现方案

### 2.1 顶部工具栏（ToolBar）放大与触控优化

#### 样式与尺寸升级：
- **容器**（`.toolbar-wrapper`）：
  - 容器垂直内边距调整为 `10px 12px`，高度增加至 56px~58px，提升视觉重心与通透度。
- **左侧工具按钮**（`.tool-btn`）：
  - 最小宽度由 `44px` 调整为 `52px`，内边距增至 `6px 6px`，圆角设为 `10px`；
  - 图标字体大小从 `15px` 提升至 `19px`；
  - 文字标签字体大小从 `10px` 提升至 `11px`，字重强化；
  - 增加按压反馈态（`&:active { transform: scale(0.94); }`）。
- **右侧操作按钮**（`.action-btn`）：
  - 按钮尺寸由 `34px × 34px` 放大至 `38px × 38px`；
  - 图标大小由 `14px` 提升至 `17px`；
  - 保持各按钮之间的安全距离（`gap: 7px`），在 375px~430px 各种屏幕宽度下弹性收缩不折行。

---

### 2.2 画板触控方块定位偏移修复

#### 根因剖析：
在微信小程序中，Canvas 2D 原生节点实例对象 `canvasNodeRef.current` 上并不存在 `getBoundingClientRect()` 方法，现有代码降级为 `{ left: 0, top: 0 }`。导致传入的 `clientX`、`clientY`（窗口全局坐标）直接作为画布坐标参与 `screenToGrid` 计算。
由于页面顶部存在原生导航栏（约 88px）及工具栏（约 56px），导致 Y 轴坐标向下偏移了约 140px+，X 轴因居中外边距偏移了约 10px。

#### 修复机制：
1. **实时与自适应矩形获取**：
   - 在 `BeadCanvas` 内部维护 `canvasRectRef = useRef<{ left: number; top: number; width: number; height: number }>({ left: 0, top: 0, width: 360, height: 480 })`；
   - 在画布初始化、窗口 `resize` 以及每次触摸开始 `handleTouchStart` 前，通过 `Taro.createSelectorQuery().select('#beadCanvas').boundingClientRect(...)` 校验更新矩形位置。
2. **多端触控坐标统一换算**：
   ```ts
   // 优先提取相对画布内偏移；若未提供则使用 client 坐标减去真实 canvasRect
   function getCanvasRelativeCoords(touch: any, canvasRect: { left: number; top: number }): { x: number; y: number } {
     if (typeof touch.x === 'number' && typeof touch.y === 'number') {
       return { x: touch.x, y: touch.y }
     }
     return {
       x: touch.clientX - canvasRect.left,
       y: touch.clientY - canvasRect.top
     }
   }
   ```
3. 在 `handleCellTap` 与 `handleTouchStart` / `handleTouchEnd` 中应用上述换算，确保点击位置 1:1 精确映射到底板单元格 `(gridX, gridY)`。

---

### 2.3 全量色号选择抽屉（FullColorPickerSheet）

#### 组件接口：
```ts
export interface FullColorPickerSheetProps {
  visible: boolean
  brand: BeadBrand
  targetPos: { x: number; y: number } | null
  currentCellColor?: BeadColor | null
  onClose: () => void
  onSelectColor: (color: BeadColor, pos: { x: number; y: number }) => void
}
```

#### 功能与结构：
1. **弹层容器**：
   - 使用 `<RootPortal enable>` 独立挂载于小程序根节点，避免被原生 Canvas 2D 层级遮挡，`z-index: 99999`；
   - 包含背景半透明遮罩（点击空白关闭）与底部滑出的抽屉卡片（最大高度 70vh，圆角 20px 20px 0 0）。
2. **顶部状态与控制栏**：
   - 标题展示当前正在编辑的方块坐标，如：`修改方块颜色 - 坐标 (24, 18)`；
   - 左右双色对比徽标：显示原颜色色块与色号，选色后即刻对比；
   - 右侧有关闭按钮 `✕`。
3. **搜索与色系筛选**：
   - 搜索输入框：支持通过色号代码（如 `A01`、`M12`）或名称即时筛选；
   - 色系横向滑块选择器：
     - `全部`
     - `图中在用`（优先列出当前图纸使用到的色号）
     - `红色粉色`
     - `黄色橙色`
     - `绿色系`
     - `蓝色青色`
     - `紫色系`
     - `黑白灰色`
4. **全量色卡网格展示**：
   - 使用 4 列响应式网格布局；
   - 每个色块展示方型真实色块、色号代码、对比文本色及高亮边框；
   - 点击任一颜色项：
     - 调用 `onSelectColor(color, targetPos)`；
     - 关闭抽屉；
     - 触发轻提示：`已将 (x, y) 设为 [色号]`。

---

### 2.4 主页面状态与交互联动（IndexPage）

1. **画笔点击触发机制**：
   - 当 `currentTool === 'pencil'` 时：
     - 点击方块不再静默填色，而是记录 `targetPos = { x, y }`，并将 `showFullColorPicker` 设为 `true`；
   - 当用户在弹窗中选择颜色后：
     - 更新对应 `grid[targetPos.y][targetPos.x]` 的色彩并标记 `isEmpty = false`；
     - 设置 `activeColor` 为所选色；
     - 记录撤销历史 `historyRef.current.pushState(nextGrid)`；
     - 刷新 `colorStats` 统计。
2. **其他工具保持原有交互**：
   - `view`（平移）、`eyedropper`（吸管）、`bucket`（油漆桶填色）、`eraser`（橡皮擦）均保持原逻辑正常工作。

---

## 3. 测试与验证策略

1. **单元测试**：
   - 为坐标转换函数新增测试，验证微信小程序 `touch.x/y` 与 `clientX/clientY - rect` 换算的准确性；
   - 为色号色系分类过滤纯函数编写单元测试；
   - 运行全量单测确保 100% 通过：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`。
2. **端侧验证**：
   - 编译微信小程序产物：`npm run build:weapp`；
   - 验证 H5 构建：`npm run build:h5`；
   - 在微信开发者工具中验证：
     1. 工具栏放大后视觉舒适，图标文字清晰，移动端触摸判定灵敏；
     2. 在画板边缘、角落及中心区域单点点击，完全无偏差，精准选中对应方块；
     3. 弹出底部抽屉，搜索色号和分类切换流畅，选中颜色后方块立即更改，色号清单实时更新。
