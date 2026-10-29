# 拼豆编辑页布局调整与交互增强设计规范

## 1. 概述与目标

为了优化小程序中拼豆画布编辑页面的排版紧凑度、视觉清晰度与交互体验，本次重构对主编辑页（`src/pages/index`）及其核心组件进行以下功能与视觉改造：

1. **移除浮标干扰**：删除画布内部原有的 `[+]`、`[-]`、比例文字与 `[居中]` 悬浮操作模块，并移除右下角悬浮的 `[# 显示色号]` 药丸按钮。
2. **新增色号清单上方操作栏 (`QuickActionBar`)**：将「显示色号」功能收纳在此模块中，并新增「左右镜像」功能，支持水平反转拼豆图纸并与底层像素及历史记录联动。
3. **画布手势与视口边界安全钳位 (`Boundary Clamping`)**：限制缩放比例与拖动范围，最小缩放限制为适应画布视口，且在拖拽平移时严格限制在视口边界内，图纸不得拖离可视区域。
4. **新增色号清单下方图纸信息模块 (`DrawingInfoCard`)**：展示图纸规格尺寸（宽 × 高）、总豆子数量以及使用颜色总数，适配暗黑/明亮主题。

---

## 2. 页面结构与组件拓扑

```
+-------------------------------------------------------------+
| 顶部微调工具栏 (ToolBar: 铅笔/吸管/油漆桶/撤销/重做/设置/导出)   |
+-------------------------------------------------------------+
| 中间画布视口 (BeadCanvas: 纯净画布，无缩放浮标，支持手势缩放)    |
|   + 原图微型缩略图悬浮卡片 (位于左下角，支持点击预览原图)       |
+-------------------------------------------------------------+
| 【新增】快捷操作栏 (QuickActionBar)                          |
|   [ ↔ 左右镜像 ]       [ # 显示色号 (开/关) ]                |
+-------------------------------------------------------------+
| 色号用量清单与寻豆面板 (ColorPaletteBar)                       |
|   - 头部信息、展开/收起、高亮提示条、色块滑动列表              |
+-------------------------------------------------------------+
| 【新增】图纸信息面板 (DrawingInfoCard)                        |
|   [ 图纸大小: 29×29 格 ] [ 豆子数量: 841 颗 ] [ 颜色数量: 12 种 ] |
+-------------------------------------------------------------+
```

---

## 3. 核心功能与模块设计

### 3.1 移除画布缩放与居中控制浮标
- **文件**：`src/components/BeadCanvas.tsx`, `src/components/BeadCanvas.scss`
- **变更**：
  - 彻底移除 `.zoom-controls` 节点及其样式代码（删除放大、缩小、居中按钮及 scale 百分比显示标签）。
  - 移除右下角的 `.color-code-toggle-badge` 节点，将该受控状态提到页面层，由外部 `showColorCodes` prop 传入。

### 3.2 快捷操作栏 (`QuickActionBar`)
- **文件**：新建 `src/components/QuickActionBar.tsx` 及 `src/components/QuickActionBar.scss`
- **位置**：位于画布视口下方、色号用量清单上方。
- **功能点**：
  1. **左右镜像 (`onMirrorHorizontal`)**：
     - 点击触发水平翻转。
     - 每一行网格反转：`nextGrid = prev.map(row => row.slice().reverse().map((cell, newX) => ({ ...cell, x: newX })))`。
     - 计入历史管理栈 `historyManager.pushState(nextGrid)`，支持 Undo 与 Redo。
     - 更新色盘用量统计 `setColorStats(getBeadColorStats(nextGrid))`。
     - 底层像素数据同步：若 `rawImagePixelsRef.current` 存在，按行交换像素（每个像素 4 字节 RGBA），确保后续量化刷新或参数调节依然保留镜像效果。
  2. **显示色号 (`onToggleColorCodes`)**：
     - 切换 `showColorCodes` 布尔状态（`true` / `false`）。
     - 按钮呈胶囊按压反馈与激活高亮态（激活时为主题主色背景或发光边框）。

### 3.3 画布手势与视口边界限制算法 (`Boundary Clamp`)
- **文件**：`src/components/BeadCanvas.tsx`, `src/utils/gesture.ts`
- **目标**：“图片的缩放只能在区域内拖动放大”。
- **算法细节**：
  1. **自适应与最小缩放**：
     - `boardW = gridW * baseCellSize`，`boardH = gridH * baseCellSize`。
     - 设视口有效可用空间为 `availW = canvasWidth`, `availH = canvasHeight`。
     - 计算适合视口的比例：`fitScale = Math.min(availW / boardW, availH / boardH)`。
     - 设定缩放区间：`minScale = fitScale`，`maxScale = 8.0`。
     - 用户双指缩小或鼠标滚轮缩小时，`scale` 最低只能缩小至 `fitScale`，避免图纸缩为小点。
  2. **拖动与平移边界钳位 (`clampViewportBounds`)**：
     - 缩放后画板实际占据尺寸为 `curW = boardW * scale`, `curH = boardH * scale`。
     - **X 轴边界约束**：
       - 若 `curW <= canvasWidth`（画板未超出视口宽度）：强制水平居中 `offsetX = Math.round((canvasWidth - curW) / 2)`。
       - 若 `curW > canvasWidth`（放大超出视口）：
         - 画板右边界不可进入视口内侧：`offsetX >= canvasWidth - curW`
         - 画板左边界不可离开视口左侧：`offsetX <= 0`
         - 即 `offsetX = Math.max(canvasWidth - curW, Math.min(0, offsetX))`。
     - **Y 轴边界约束**：
       - 若 `curH <= canvasHeight`（画板未超出视口高度）：强制垂直居中 `offsetY = Math.round((canvasHeight - curH) / 2)`。
       - 若 `curH > canvasHeight`（放大超出视口）：
         - 画板下边界不可进入视口内侧：`offsetY >= canvasHeight - curH`
         - 画板上边界不可离开视口上方：`offsetY <= 0`
         - 即 `offsetY = Math.max(canvasHeight - curH, Math.min(0, offsetY))`。
  3. **应用时机**：
     - 在手势移动 `onTouchMove`、鼠标移动 `onMouseMove`、双指缩放 `handleTouchMove` 以及滚轮缩放 `zoomAtPoint` 中，实时应用 `clampViewportBounds`。

### 3.4 图纸信息模块 (`DrawingInfoCard`)
- **文件**：新建 `src/components/DrawingInfoCard.tsx` 及 `src/components/DrawingInfoCard.scss`
- **位置**：位于色号清单 (`ColorPaletteBar`) 的下方。
- **展示内容**：
  1. **图纸大小**：展示规格如 `29 × 29 格`。
  2. **豆子数量**：展示实际所需豆子总数（统计排除空白/透明珠），如 `841 颗`。
  3. **颜色数量**：统计当前已使用颜色数量，如 `12 种`。
- **样式与适配**：
  - 三栏等宽卡片，带浅微渐变与精美圆角、细边框。
  - 支持暗黑主题与明亮主题。

---

## 4. 状态传递与数据流

- `IndexPage` 管理主状态：
  - `showColorCodes: boolean`（默认为 `false` 或从缓存加载）
  - `grid: BeadCell[][]`
  - `colorStats: Map<string, BeadColorStatItem>`
  - `boardWidth: number`, `boardHeight: number`
- `QuickActionBar` 接收：
  - `showColorCodes: boolean`
  - `onToggleColorCodes: () => void`
  - `onMirrorHorizontal: () => void`
- `DrawingInfoCard` 接收：
  - `width: number`
  - `height: number`
  - `totalBeads: number`
  - `colorCount: number`

---

## 5. 验证与测试规范

1. **左右镜像验证**：
   - 加载非对称样例图（如宝可梦经典图案），点击「左右镜像」，确认画布左右正确颠倒。
   - 点击顶部微调栏「撤销」，验证图纸还原为初始方向；点击「重做」，验证再次翻转。
   - 验证导出图纸时，图纸内容与当前镜像状态完全一致。
2. **浮标移除验证**：
   - 确认原浮动缩放组件与原右下角浮动色号徽标已完全移除，画布无任何冗余浮标遮挡。
3. **手势边界限制验证**：
   - 在未放大时拖动画布，确认图纸自动吸附居中，无法拖离视口。
   - 双指放大至 200% 以上，拖动画布，确认边缘触碰视口边界即被钳位截断，图纸主体始终保持在视口内。
   - 尝试不断缩小，确认缩放到刚好适配视口（`fitScale`）时停止缩小，无法缩至过小。
4. **图纸信息卡片验证**：
   - 验证尺寸、总豆数、颜色种类数据与实际网格完全吻合。
   - 切换不同尺寸（如 52×52）或不同样图，验证卡片信息实时更新。
