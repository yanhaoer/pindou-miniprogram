# 拼豆小程序：工具栏整行放大、下载图纸按钮下移与图纸样式对齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 顶部工具栏 7 键均分放大撑满整行；移除原导出与设置按键；快捷栏补充设置按钮；图形信息下方提供大号“下载图纸”按钮；生成图纸样式完全对齐“图2”并植入小程序码。

**Architecture:**
1. 在 `src/utils/exporter.ts` 中重构 `calculateSheetDimensions` 与 `renderCraftSheet`：采用方形网格单元格并在中心打印高对比度清晰色号，顶部/左侧每 5 格标注标尺数字，底部左侧紧凑多列颜色清单，底部右侧绘制小程序二维码与文案。
2. 在 `src/components/ToolBar.tsx` 及 `ToolBar.scss` 中精简按键，使 7 个编辑/历史按键通过 `flex: 1` 均分整行，字号与图标全面放大。
3. 在 `src/components/QuickActionBar.tsx` 中新增“⚙️ 设置”按键。
4. 在 `src/pages/index/index.tsx` 中紧随 `DrawingInfoCard` 添加大号“下载图纸”按钮卡片并联动导出逻辑。

**Tech Stack:** Taro 4.3 (React 18), TypeScript, SCSS, HTML5 Canvas 2D, Vitest

## Global Constraints

- 不可破坏现有平移缩放、网格吸色、色号过滤、撤销重做、水平镜像与坐标刻度展示功能。
- 导出的图纸在微信小程序 Native Canvas 2D 与 H5 Web 浏览器端均需能够正常导出并绘制小程序二维码。
- 测试必须使用 `bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'` 运行验证。

---

### Task 1: 图纸导出渲染模块重构对齐“图2”版式与单测

**Files:**
- Modify: `src/utils/exporter.ts`
- Modify: `tests/utils/exporter.test.ts`
- Read: `src/assets/qrcode.ts`

**Interfaces:**
- Consumes: `QRCODE_BASE64` from `src/assets/qrcode.ts`
- Produces:
  ```ts
  export function calculateSheetDimensions(
    gridW: number,
    gridH: number,
    colorCount: number,
    options?: SheetDimensionOptions
  ): SheetDimensions
  export function renderCraftSheet(
    ctx: any,
    grid: BeadCell[][],
    paletteName: string,
    stats: Map<string, BeadColorStatItem>,
    dims: SheetDimensions,
    qrImageObj?: any
  ): void
  ```

- [x] **Step 1: 编写/更新图纸尺寸计算与版式单元测试**

在 `tests/utils/exporter.test.ts` 中更新测试用例：
```ts
import { describe, it, expect } from 'vitest'
import { calculateSheetDimensions } from '@/utils/exporter'

describe('calculateSheetDimensions', () => {
  it('calculates proper canvas dimensions for square grid and legend', () => {
    const dims = calculateSheetDimensions(29, 29, 12, { cellSize: 22, rulerSize: 28, margin: 20 })
    expect(dims.boardWidth).toBe(29 * 22)
    expect(dims.boardHeight).toBe(29 * 22)
    expect(dims.width).toBeGreaterThanOrEqual(dims.boardWidth + 28 + 40)
    expect(dims.height).toBeGreaterThan(dims.boardHeight + 28 + 40)
    expect(dims.cellSize).toBe(22)
  })

  it('handles small grid dimensions with minimum width bounds', () => {
    const dims = calculateSheetDimensions(10, 10, 5)
    expect(dims.width).toBeGreaterThanOrEqual(720)
  })
})
```

- [x] **Step 2: 运行单测验证**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/exporter.test.ts'`
预期：PASS 或确认需调整处

- [x] **Step 3: 在 `src/utils/exporter.ts` 中实现对齐“图2”的版式绘制**

在 `src/utils/exporter.ts` 中更新实现：
1. 顶部横向标尺（1, 6, 11, 16, 21, 26, 31... 及最后一列号，居中对应列）。
2. 左侧纵向标尺（1, 6, 11, 16, 21, 26, 31... 及最后一行号，居中对应行）。
3. 方形珠子网格：
   - 填充单元格矩形：`ctx.fillRect(cellX, cellY, cellSize, cellSize)`。
   - 细线边框：`ctx.strokeRect(cellX, cellY, cellSize, cellSize)`。
   - 每 5 格绘制加深网格分割线。
   - 单元格中心绘制清晰对比度的色号代号（如 `E4`），自适应字号。
4. 底部左侧：
   - 标题：“颜色清单：”。
   - 紧凑网格排布方块色样 + `${code} ${count}颗`。
5. 底部右侧：
   - 绘制小程序二维码（图片对象或基于 Base64 的 Image）。
   - 下方绘制提示文案：“扫码转手残粉 / 点文免费·图纸自取”。

- [x] **Step 4: 运行单测确认全部通过**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/exporter.test.ts'`
预期：PASS

---

### Task 2: 顶部工具栏 7 键均分放大撑满整行

**Files:**
- Modify: `src/components/ToolBar.tsx`
- Modify: `src/components/ToolBar.scss`

**Interfaces:**
- `ToolBarProps`:
  ```ts
  export interface ToolBarProps {
    currentTool: EditTool
    canUndo: boolean
    canRedo: boolean
    onSelectTool: (tool: EditTool) => void
    onUndo: () => void
    onRedo: () => void
  }
  ```

- [x] **Step 1: 更新 `ToolBar.tsx` 结构**

移除 `onOpenConfig` 与 `onExport` props，移除右侧的分割线与设置/导出按键，将 5 个工具与 2 个历史按键统一放置在单行 flex 容器中：
```tsx
export const ToolBar: React.FC<ToolBarProps> = ({
  currentTool,
  canUndo,
  canRedo,
  onSelectTool,
  onUndo,
  onRedo
}) => {
  return (
    <View className="toolbar-wrapper">
      {tools.map(tool => (
        <View
          key={tool.id}
          className={`tool-btn ${currentTool === tool.id ? 'active' : ''}`}
          onClick={() => onSelectTool(tool.id)}
        >
          <Text className="icon">{tool.icon}</Text>
          <Text className="label">{tool.name}</Text>
        </View>
      ))}

      <View
        className={`tool-btn action-btn ${!canUndo ? 'disabled' : ''}`}
        onClick={() => canUndo && onUndo()}
      >
        <Text className="icon">↩️</Text>
        <Text className="label">撤销</Text>
      </View>

      <View
        className={`tool-btn action-btn ${!canRedo ? 'disabled' : ''}`}
        onClick={() => canRedo && onRedo()}
      >
        <Text className="icon">↪️</Text>
        <Text className="label">重做</Text>
      </View>
    </View>
  )
}
```

- [x] **Step 2: 更新 `ToolBar.scss` 样式**

```scss
.toolbar-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 6px;
  min-height: 58px;
  background: #18191f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
  gap: 4px;
}

.tool-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 2px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;

  &.active {
    background: #3b82f6;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.55);

    .label {
      color: #ffffff;
      font-weight: bold;
    }
  }

  &.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &:active:not(.disabled) {
    transform: scale(0.92);
  }

  .icon {
    font-size: 22px;
    line-height: 1.1;
  }

  .label {
    font-size: 12px;
    color: #cfd3dc;
    margin-top: 3px;
    font-weight: 600;
    white-space: nowrap;
  }
}
```

- [x] **Step 3: 运行单测验证无破坏**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：PASS

---

### Task 3: 快捷操作栏新增“参数设置”按键

**Files:**
- Modify: `src/components/QuickActionBar.tsx`
- Modify: `src/components/QuickActionBar.scss`

- [x] **Step 1: 在 `QuickActionBar.tsx` 中添加 `onOpenConfig` 属性与按键**

```tsx
export interface QuickActionBarProps {
  showColorCodes: boolean
  showRulers: boolean
  onToggleColorCodes: () => void
  onToggleRulers: () => void
  onMirrorHorizontal: () => void
  onOpenConfig?: () => void
}
```
并在 JSX 中添加第 4 个按钮：
```tsx
<View className="quick-btn" onClick={onOpenConfig}>
  <Text className="quick-icon">⚙️</Text>
  <Text className="quick-label">设置</Text>
</View>
```

- [x] **Step 2: 更新 `QuickActionBar.scss`**

确保 4 个按钮在一行中自适应对齐。

- [x] **Step 3: 运行单测验证**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：PASS

---

### Task 4: 图形信息卡片下方增加大号“下载图纸”按钮与页面逻辑联动

**Files:**
- Modify: `src/pages/index/index.tsx`
- Modify: `src/pages/index/index.scss`

- [x] **Step 1: 在 `index.tsx` 中在 `DrawingInfoCard` 下方添加下载按钮卡片**

```tsx
{/* 图纸信息面板下方：醒目大号下载图纸按钮 */}
<View className="export-action-card">
  <View className="download-sheet-btn" onClick={handleExportSheet}>
    <Text className="btn-icon">📥</Text>
    <Text className="btn-text">下载高清施工图纸</Text>
  </View>
  <Text className="btn-hint">全幅对齐标准施工图纸 · 含坐标与色号清单 · 自动保存相册</Text>
</View>
```

- [x] **Step 2: 编写 `export-action-card` 样式**

在 `src/pages/index/index.scss` 中实现渐变背景、阴影和移动端触控动效：
```scss
.export-action-card {
  margin: 12px 14px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.download-sheet-btn {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #4f46e5 100%);
  border-radius: 14px;
  box-shadow: 0 4px 18px rgba(37, 99, 235, 0.45);
  cursor: pointer;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.97);
    box-shadow: 0 2px 10px rgba(37, 99, 235, 0.3);
  }

  .btn-icon {
    font-size: 20px;
  }

  .btn-text {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.5px;
  }
}

.btn-hint {
  font-size: 11px;
  color: #94a3b8;
}
```

- [x] **Step 3: 在 `index.tsx` 中更新 `ToolBar` 与 `QuickActionBar` 属性绑定**

在 `ToolBar` 中移除 `onOpenConfig` 和 `onExport`；
在 `QuickActionBar` 中传入 `onOpenConfig={() => { canvasRef.current?.getSnapshot?.(); setShowConfigModal(true); }}`。

- [x] **Step 4: 运行单测验证**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：PASS

---

### Task 5: 全量单测与双端编译验证

- [x] **Step 1: 运行全量单元测试**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：9 套件 100% 通过。

- [x] **Step 2: 运行微信小程序构建**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npm run build:weapp'`
预期：Webpack 编译成功。

- [x] **Step 3: 运行 H5 构建**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npm run build:h5'`
预期：顺利输出至 `dist-h5/`，双端无报错。
