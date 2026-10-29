# 拼豆画板四周坐标刻度展示功能设计规范

## 1. 概述与目标

用户在拼豆施工与微调过程中，需要根据行列坐标快速定位某颗豆子在底板上的精确物理位置（例如第 15 行第 20 列）。本设计在图片下方的快捷操作栏（`QuickActionBar`）中增加「显示刻度 / 隐藏刻度」控制开关，开启后在拼豆画板（`BeadCanvas`）四周完整渲染对齐的行号与列号刻度标尺，使每一个方块旁边均有清晰可对照的坐标数字。

---

## 2. 界面与交互设计

### 2.1 快捷操作栏按钮扩展 (`QuickActionBar`)
- **位置**：位于画布视口下方、色号用量清单上方。
- **按钮结构**：包含 3 个紧凑功能按钮：
  1. `[↔ 左右镜像]`
  2. `[# 显示色号]`
  3. `[📐 显示刻度 / 隐藏刻度]`（新增）
- **状态表现**：
  - 未开启（默认）：背景半透明暗色，显示图标 `📐` 与文本“显示刻度”。
  - 开启状态：背景高亮蓝，显示图标 `📐` 与文本“隐藏刻度”，具有明显的激活态。

### 2.2 画板四周坐标刻度渲染规范 (`BeadCanvas`)
- **渲染位置**：
  - **顶部标尺（Top Ruler）**：画板顶部上方，居中渲染每一列的列号 `1, 2, ..., gridW`。
  - **底部标尺（Bottom Ruler）**：画板底部下方，居中渲染每一列的列号 `1, 2, ..., gridW`。
  - **左侧标尺（Left Ruler）**：画板左侧外缘，垂直居中渲染每一行的行号 `1, 2, ..., gridH`。
  - **右侧标尺（Right Ruler）**：画板右侧外缘，垂直居中渲染每一行的行号 `1, 2, ..., gridH`。
- **标尺带尺寸（Ruler Band Size）**：
  - 设 `rulerBand = showRulers ? Math.max(16, Math.min(28, scaledCell * 0.9)) : 0`。
  - 画板总宽度为 `totalBoardW = boardW + rulerBand * 2`，总高度为 `totalBoardH = boardH + rulerBand * 2`。
- **自适应抽稀与字号排版**：
  - 字号计算：`fontSize = Math.min(10, Math.max(7, Math.floor(scaledCell * 0.42)))`。
  - 当缩放到每格像素较小（`scaledCell < 12px`）时：优先每 5 格或 10 格展示完整数字（如 1, 5, 10, 15...），中间格显示短刻度线，避免数字粘连；
  - 当放大至正常或较大倍数（`scaledCell >= 12px`）时：**所有方块对应的行号和列号全部完整呈现**。
- **标尺线与辅助参考线**：
  - 标尺背景带呈轻微反差背景（暗黑模式下为深灰半透明，明亮模式下为浅灰）。
  - 每 5 格及 10 格绘制加粗延伸刻度标记，直通网格内部标尺分割线。

### 2.3 视口手势与边界约束适配
- 在 `centerAndFitBoard` 及 `clampViewportBounds` 中，当 `showRulers === true` 时，计算可用视口时扣除四周 `rulerBand` 空间，确保在初始居中和用户拖动放大时，四周的数字刻度始终在视口内部完全显示，不会被外层剪裁溢出。

---

## 3. 组件接口与状态传递

- `IndexPage` 维护状态：
  - `showRulers: boolean`（默认为 `false`）
  - `handleToggleRulers = () => setShowRulers(prev => !prev)`
- `QuickActionBar` Props 变更：
  ```ts
  export interface QuickActionBarProps {
    showColorCodes: boolean
    showRulers: boolean
    onToggleColorCodes: () => void
    onToggleRulers: () => void
    onMirrorHorizontal: () => void
  }
  ```
- `BeadCanvas` Props 变更：
  ```ts
  export interface BeadCanvasProps {
    // ...
    showRulers?: boolean
  }
  ```

---

## 4. 验证与回归测试

1. **按钮状态切换**：点击「显示刻度」，按钮变为激活状态且文案切换为「隐藏刻度」，画布重新渲染并展示四周数字；再次点击隐藏刻度，画布还原为纯净网格。
2. **坐标精确对齐**：验证顶部列号 1 与第 1 列方块中心对齐，左侧行号 1 与第 1 行方块中心对齐；第 N 列/行对齐第 N 列/行。
3. **手势平移与缩放**：在开启刻度状态下双指缩放、拖动平移，验证四周刻度与网格方块严格保持 1:1 同步移动，数字不漂移、不抖动。
4. **单元测试与双端编译**：更新单测，运行 `vitest` 与 `build:weapp / build:h5` 验证通过。
