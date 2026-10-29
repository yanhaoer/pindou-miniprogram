# 拼豆编辑页布局调整与交互增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构拼豆编辑页布局：移除画板内部悬浮缩放与居中模块，在色号清单上方新增包含左右镜像与显示色号的快捷操作栏，限制画板拖拽缩放边界在视口内，并在色号清单下方新增图纸信息统计面板。

**Architecture:** 
1. 将几何与视口边界计算抽取至 `src/utils/gesture.ts`，增加 `clampViewportBounds` 纯函数并编写完备单元测试。
2. 将网格水平翻转与像素翻转纯函数抽离至 `src/utils/quantizer.ts`，支持撤销/重做与底层图片缓存更新。
3. 创建两个独立展示组件 `QuickActionBar`（快捷操作栏）与 `DrawingInfoCard`（图纸信息卡片），在 `IndexPage` 中通过清晰的纵向层级串联，彻底移除 `BeadCanvas` 内部的悬浮工具浮标。

**Tech Stack:** Taro 4.3 (React 18), TypeScript, SCSS, Vitest

## Global Constraints

- 遵循既有主题切换体系（`.theme-dark` / `.theme-light`）。
- 保持对微信小程序（WeApp Canvas 2D）与 Web/H5 环境的双重兼容。
- 保证历史管理栈 `HistoryManager` 正确记录翻转操作，支持无缝撤销/重做。
- 测试需使用 `bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'` 确保 Node 20 环境。

---

### Task 1: 视口边界钳位算法 (`clampViewportBounds`) 及单测

**Files:**
- Modify: `src/utils/gesture.ts`
- Test: `tests/utils/gesture.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function clampViewportBounds(
    viewport: Viewport,
    containerW: number,
    containerH: number,
    boardW: number,
    boardH: number
  ): Viewport
  ```

- [ ] **Step 1: 编写边界钳位测试用例**

在 `tests/utils/gesture.test.ts` 中追加 `clampViewportBounds` 的测试用例：
```ts
describe('clampViewportBounds', () => {
  it('centers board when scaled board is smaller than container', () => {
    const vp = { scale: 1.0, offsetX: 0, offsetY: 0 }
    const result = clampViewportBounds(vp, 400, 400, 200, 200)
    expect(result.offsetX).toBe(100)
    expect(result.offsetY).toBe(100)
  })

  it('clamps offsetX and offsetY within [container - board, 0] when board is larger than container', () => {
    // 画板放大后为 600x600，容器为 400x400。允许 offsetX 范围为 [-200, 0]
    const vp1 = { scale: 1.0, offsetX: 50, offsetY: -300 }
    const result1 = clampViewportBounds(vp1, 400, 400, 600, 600)
    expect(result1.offsetX).toBe(0) // 超过最大值 0，钳位为 0
    expect(result1.offsetY).toBe(-200) // 小于最小值 -200，钳位为 -200
  })
})
```

- [ ] **Step 2: 运行单测验证失败**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/gesture.test.ts'`
预期：FAIL（`clampViewportBounds is not a function`）

- [ ] **Step 3: 实现 `clampViewportBounds`**

在 `src/utils/gesture.ts` 中实现：
```ts
export function clampViewportBounds(
  viewport: Viewport,
  containerW: number,
  containerH: number,
  boardW: number,
  boardH: number
): Viewport {
  const scaledW = boardW * viewport.scale
  const scaledH = boardH * viewport.scale

  let nextOffsetX = viewport.offsetX
  let nextOffsetY = viewport.offsetY

  // X 轴约束
  if (scaledW <= containerW) {
    nextOffsetX = Math.round((containerW - scaledW) / 2)
  } else {
    const minX = containerW - scaledW
    const maxX = 0
    nextOffsetX = Math.round(Math.max(minX, Math.min(maxX, nextOffsetX)))
  }

  // Y 轴约束
  if (scaledH <= containerH) {
    nextOffsetY = Math.round((containerH - scaledH) / 2)
  } else {
    const minY = containerH - scaledH
    const maxY = 0
    nextOffsetY = Math.round(Math.max(minY, Math.min(maxY, nextOffsetY)))
  }

  return {
    scale: viewport.scale,
    offsetX: nextOffsetX,
    offsetY: nextOffsetY
  }
}
```

- [ ] **Step 4: 运行单测验证通过**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/gesture.test.ts'`
预期：PASS

---

### Task 2: 网格水平镜像与像素镜像纯函数及单测

**Files:**
- Modify: `src/utils/quantizer.ts`
- Test: `tests/utils/quantizer.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function mirrorGridHorizontal(grid: BeadCell[][]): BeadCell[][]
  export function mirrorRawPixelsHorizontal(
    pixels: Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8ClampedArray
  ```

- [ ] **Step 1: 编写水平镜像测试用例**

在 `tests/utils/quantizer.test.ts` 中追加：
```ts
describe('mirrorGridHorizontal', () => {
  it('flips grid columns horizontally and updates x coordinates', () => {
    const colorA = { code: 'A', name: 'Color A', hex: '#ff0000', rgb: [255, 0, 0] as [number, number, number] }
    const colorB = { code: 'B', name: 'Color B', hex: '#00ff00', rgb: [0, 255, 0] as [number, number, number] }
    const sampleGrid: BeadCell[][] = [
      [
        { x: 0, y: 0, color: colorA, isEmpty: false },
        { x: 1, y: 0, color: colorB, isEmpty: false }
      ]
    ]
    const mirrored = mirrorGridHorizontal(sampleGrid)
    expect(mirrored[0][0].color.code).toBe('B')
    expect(mirrored[0][0].x).toBe(0)
    expect(mirrored[0][1].color.code).toBe('A')
    expect(mirrored[0][1].x).toBe(1)
  })
})

describe('mirrorRawPixelsHorizontal', () => {
  it('mirrors pixel rgba data horizontally', () => {
    // 2x1 图像：左红右绿
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,   // x=0: 红色
      0, 255, 0, 255    // x=1: 绿色
    ])
    const mirrored = mirrorRawPixelsHorizontal(pixels, 2, 1)
    expect(mirrored[0]).toBe(0)   // x=0 变成绿色
    expect(mirrored[1]).toBe(255)
    expect(mirrored[4]).toBe(255) // x=1 变成红色
    expect(mirrored[5]).toBe(0)
  })
})
```

- [ ] **Step 2: 运行单测验证失败**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/quantizer.test.ts'`
预期：FAIL（`mirrorGridHorizontal is not defined`）

- [ ] **Step 3: 实现 `mirrorGridHorizontal` 与 `mirrorRawPixelsHorizontal`**

在 `src/utils/quantizer.ts` 中追加导出：
```ts
export function mirrorGridHorizontal(grid: BeadCell[][]): BeadCell[][] {
  if (!grid || grid.length === 0) return []
  const gridW = grid[0].length
  return grid.map(row => {
    const reversed = [...row].reverse()
    return reversed.map((cell, newX) => ({
      ...cell,
      x: newX
    }))
  })
}

export function mirrorRawPixelsHorizontal(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(pixels.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4
      const dstIdx = (y * width + (width - 1 - x)) * 4
      output[dstIdx] = pixels[srcIdx]
      output[dstIdx + 1] = pixels[srcIdx + 1]
      output[dstIdx + 2] = pixels[srcIdx + 2]
      output[dstIdx + 3] = pixels[srcIdx + 3]
    }
  }
  return output
}
```

- [ ] **Step 4: 运行单测验证通过**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/quantizer.test.ts'`
预期：PASS

---

### Task 3: 改造 `BeadCanvas`（移除浮标控件并接入边界钳位）

**Files:**
- Modify: `src/components/BeadCanvas.tsx`
- Modify: `src/components/BeadCanvas.scss`

**Interfaces:**
- Consumes:
  - `clampViewportBounds` from `@/utils/gesture`
- Modifies `BeadCanvasProps`:
  - 移除原内置 `.zoom-controls` DOM
  - 移除原内置 `.color-code-toggle-badge` DOM
  - 缩放平移严格受限于视口内

- [ ] **Step 1: 修改 `BeadCanvas.tsx` 交互与渲染**

1. 导入 `clampViewportBounds`。
2. 在 `centerAndFitBoard` 中，计算 `initialScale` 后，限制 `minScale = initialScale`。
3. 在 `zoomAtPoint` 中：
   - 最小缩放改为当前画板的适配比例 `fitScale`（即不能缩得比画布视口还小）。
   - 在应用新的 `scale` 和 `offsetX / offsetY` 后，调用 `clampViewportBounds` 钳位。
4. 在 `handleTouchMove` 和 `handleMouseMove` 中，平移计算后调用 `clampViewportBounds` 进行边界截断。
5. 彻底删除 JSX 中的 `.zoom-controls` 元素与 `.color-code-toggle-badge` 元素。

- [ ] **Step 2: 清理 `BeadCanvas.scss` 冗余样式**

删除 `.zoom-controls`、`.zoom-btn`、`.zoom-text`、`.reset-btn` 与 `.color-code-toggle-badge` 相关的样式，减少包体积与样式冗余。

- [ ] **Step 3: 运行自动化测试验证手势与功能未受损坏**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：全部现有单测 PASS。

---

### Task 4: 实现 `QuickActionBar` 组件

**Files:**
- Create: `src/components/QuickActionBar.tsx`
- Create: `src/components/QuickActionBar.scss`

**Interfaces:**
- Produces:
  ```ts
  export interface QuickActionBarProps {
    showColorCodes: boolean
    onToggleColorCodes: () => void
    onMirrorHorizontal: () => void
  }
  export const QuickActionBar: React.FC<QuickActionBarProps>
  ```

- [ ] **Step 1: 创建 `src/components/QuickActionBar.tsx`**

实现快捷操作栏，包含两个按钮：
- 左右镜像（带 ↔ 图标，点击调用 `onMirrorHorizontal`）
- 显示色号（带 # 图标，根据 `showColorCodes` 切换高亮样式，点击调用 `onToggleColorCodes`）

```tsx
import React from 'react'
import { View, Text } from '@tarojs/components'
import './QuickActionBar.scss'

export interface QuickActionBarProps {
  showColorCodes: boolean
  onToggleColorCodes: () => void
  onMirrorHorizontal: () => void
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  showColorCodes,
  onToggleColorCodes,
  onMirrorHorizontal
}) => {
  return (
    <View className="quick-action-bar">
      <View className="action-btn" onClick={onMirrorHorizontal} hoverClass="btn-hover">
        <Text className="btn-icon">↔</Text>
        <Text className="btn-label">左右镜像</Text>
      </View>

      <View
        className={`action-btn toggle-code-btn ${showColorCodes ? 'active' : ''}`}
        onClick={onToggleColorCodes}
        hoverClass="btn-hover"
      >
        <Text className="btn-icon">#</Text>
        <Text className="btn-label">{showColorCodes ? '隐藏色号' : '显示色号'}</Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建 `src/components/QuickActionBar.scss`**

编写扁平胶囊布局与暗黑/明亮模式自适应样式：
- 左右两端或居中排列、轻量阴影、圆角。
- `.action-btn.active` 支持高亮蓝紫色渐变或发光边框。

---

### Task 5: 实现 `DrawingInfoCard` 组件

**Files:**
- Create: `src/components/DrawingInfoCard.tsx`
- Create: `src/components/DrawingInfoCard.scss`

**Interfaces:**
- Produces:
  ```ts
  export interface DrawingInfoCardProps {
    width: number
    height: number
    totalBeads: number
    colorCount: number
  }
  export const DrawingInfoCard: React.FC<DrawingInfoCardProps>
  ```

- [ ] **Step 1: 创建 `src/components/DrawingInfoCard.tsx`**

实现图纸信息模块，展示「图纸大小」、「豆子数量」、「颜色数量」三列卡片：
```tsx
import React from 'react'
import { View, Text } from '@tarojs/components'
import './DrawingInfoCard.scss'

export interface DrawingInfoCardProps {
  width: number
  height: number
  totalBeads: number
  colorCount: number
}

export const DrawingInfoCard: React.FC<DrawingInfoCardProps> = ({
  width,
  height,
  totalBeads,
  colorCount
}) => {
  return (
    <View className="drawing-info-card">
      <View className="info-item">
        <Text className="info-label">图纸大小</Text>
        <Text className="info-value">{width} × {height} <Text className="info-unit">格</Text></Text>
      </View>

      <View className="info-divider" />

      <View className="info-item">
        <Text className="info-label">豆子数量</Text>
        <Text className="info-value">{totalBeads} <Text className="info-unit">颗</Text></Text>
      </View>

      <View className="info-divider" />

      <View className="info-item">
        <Text className="info-label">颜色数量</Text>
        <Text className="info-value">{colorCount} <Text className="info-unit">种</Text></Text>
      </View>
    </View>
  )
}
```

- [ ] **Step 2: 创建 `src/components/DrawingInfoCard.scss`**

卡片样式：暗黑质感背景（如 `#181920`）、磨砂边框、细分割线、字体层级区分（主数值高亮）。

---

### Task 6: 组装到编辑主页 (`src/pages/index`) 并联调样式

**Files:**
- Modify: `src/pages/index/index.tsx`
- Modify: `src/pages/index/index.scss`

- [ ] **Step 1: 在 `index.tsx` 中引入新组件与逻辑**

1. 引入 `QuickActionBar` 与 `DrawingInfoCard`。
2. 引入 `mirrorGridHorizontal` 与 `mirrorRawPixelsHorizontal`。
3. 增加 `showColorCodes` 页面状态：
   ```tsx
   const [showColorCodes, setShowColorCodes] = useState(false)
   ```
4. 实现 `handleMirrorHorizontal`：
   ```tsx
   const handleMirrorHorizontal = useCallback(() => {
     if (!grid || grid.length === 0) return
     const nextGrid = mirrorGridHorizontal(grid)
     setGrid(nextGrid)
     setColorStats(getBeadColorStats(nextGrid))
     historyRef.current.pushState(nextGrid)
     updateHistoryState()

     if (rawImagePixelsRef.current && rawImageWidthRef.current > 0) {
       rawImagePixelsRef.current = mirrorRawPixelsHorizontal(
         rawImagePixelsRef.current,
         rawImageWidthRef.current,
         rawImageHeightRef.current
       )
     }
     Taro.showToast({ title: '已水平镜像', icon: 'none', duration: 1000 })
   }, [grid, updateHistoryState])
   ```
5. 计算统计数据并传给 `DrawingInfoCard`：
   ```tsx
   const totalBeadCount = useMemo(() => {
     let sum = 0
     colorStats.forEach(item => { sum += item.count })
     return sum
   }, [colorStats])
   ```
6. 调整 JSX 布局结构：
   - `BeadCanvas` 传入 `showColorCodes={showColorCodes}`。
   - 在 `BeadCanvas` 视口下、`ColorPaletteBar` 之上插入 `QuickActionBar`。
   - 在 `ColorPaletteBar` 之下插入 `DrawingInfoCard`。

- [ ] **Step 2: 调整 `src/pages/index/index.scss` 布局与响应式自适应**

为让新增的模块在不同高度的小程序屏幕上舒适展示：
- 将 `.app-container` 内部的内容区设为弹性流式布局，自适应可用高度。
- 确保滚动区域流畅，底部 `DrawingInfoCard` 具有贴合安全区的边距（`padding-bottom: env(safe-area-inset-bottom, 12px)`）。

---

### Task 7: 完整回归验证与测试

- [ ] **Step 1: 运行全量单元测试**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：全量测试 100% 通过。

- [ ] **Step 2: 验证编译状态与打包**

运行编译命令确保无任何语法错误与类型警告：
`npm run build:h5`
预期：编译成功退出代码 0。
