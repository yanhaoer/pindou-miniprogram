# 拼豆画板四周坐标刻度展示功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在图片下方快捷操作栏中增加「显示刻度」开关，开启后在拼豆画板四周渲染与每个方块行列对齐的坐标数字标尺（顶部/底部列号，左侧/右侧行号），实现精确坐标辅助。

**Architecture:**
1. 在 `src/utils/ruler.ts` 中实现标尺尺寸与刻度抽稀计算纯函数，并补充单元测试。
2. 扩展 `QuickActionBar`，新增「显示刻度 / 隐藏刻度」控制按钮与激活样式。
3. 改造 `BeadCanvas`，在主渲染循环中增加四周坐标标尺绘制逻辑，并在视口居中与边界钳位计算中将标尺带纳入安全边界。
4. 在 `IndexPage` 中接入 `showRulers` 状态并完成双端编译与全量单测验证。

**Tech Stack:** Taro 4.3 (React 18), TypeScript, SCSS, Vitest

## Global Constraints

- 保证坐标数字在明亮模式与暗黑模式下均具备清晰的可读性与对比度。
- 坐标数字必须与每一行、每一列的方块几何中心严格对齐。
- 在缩放与拖拽时，标尺与方块网格 100% 保持同步平移与缩放。
- 测试需使用 `bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`。

---

### Task 1: 标尺计算纯函数 (`src/utils/ruler.ts`) 及单元测试

**Files:**
- Create: `src/utils/ruler.ts`
- Create: `tests/utils/ruler.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function getRulerBandSize(scaledCell: number, showRulers: boolean): number
  export function shouldShowRulerTickNumber(index: number, total: number, scaledCell: number): boolean
  export function computeRulerFontSize(scaledCell: number): number
  ```

- [ ] **Step 1: 编写标尺计算单元测试**

在 `tests/utils/ruler.test.ts` 中编写测试：
```ts
import { describe, it, expect } from 'vitest'
import { getRulerBandSize, shouldShowRulerTickNumber, computeRulerFontSize } from '@/utils/ruler'

describe('Ruler Calculation System', () => {
  it('returns 0 band size when showRulers is false', () => {
    expect(getRulerBandSize(20, false)).toBe(0)
  })

  it('calculates proper band size when showRulers is true', () => {
    expect(getRulerBandSize(10, true)).toBeGreaterThanOrEqual(16)
    expect(getRulerBandSize(40, true)).toBeLessThanOrEqual(32)
  })

  it('shows all tick numbers when scaledCell is sufficiently large (>= 12px)', () => {
    expect(shouldShowRulerTickNumber(0, 30, 15)).toBe(true)
    expect(shouldShowRulerTickNumber(1, 30, 15)).toBe(true)
    expect(shouldShowRulerTickNumber(2, 30, 15)).toBe(true)
  })

  it('steps every 5 or endpoints when scaledCell is small (< 12px)', () => {
    expect(shouldShowRulerTickNumber(0, 30, 8)).toBe(true)      // 1
    expect(shouldShowRulerTickNumber(4, 30, 8)).toBe(true)      // 5
    expect(shouldShowRulerTickNumber(29, 30, 8)).toBe(true)     // 30
    expect(shouldShowRulerTickNumber(1, 30, 8)).toBe(false)     // 2 (skipped to avoid overlapping)
  })
})
```

- [ ] **Step 2: 运行单测验证失败**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/ruler.test.ts'`
预期：FAIL（文件不存在）

- [ ] **Step 3: 实现 `src/utils/ruler.ts`**

实现标尺计算工具库：
```ts
/**
 * Calculate the width/height of the ruler band around the grid
 */
export function getRulerBandSize(scaledCell: number, showRulers: boolean): number {
  if (!showRulers) return 0
  return Math.round(Math.max(16, Math.min(26, scaledCell * 0.85)))
}

/**
 * Determine whether to show the text number for column/row index (0-based index)
 */
export function shouldShowRulerTickNumber(index: number, total: number, scaledCell: number): boolean {
  if (scaledCell >= 12) {
    return true
  }
  const naturalNumber = index + 1
  return naturalNumber === 1 || naturalNumber === total || naturalNumber % 5 === 0
}

/**
 * Compute the font size for ruler tick numbers
 */
export function computeRulerFontSize(scaledCell: number): number {
  return Math.min(10, Math.max(7, Math.floor(scaledCell * 0.45)))
}
```

- [ ] **Step 4: 运行单测验证通过**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/ruler.test.ts'`
预期：PASS

---

### Task 2: 扩展 `QuickActionBar` 组件支持刻度开关

**Files:**
- Modify: `src/components/QuickActionBar.tsx`
- Modify: `src/components/QuickActionBar.scss`

**Interfaces:**
- Updates `QuickActionBarProps`:
  ```ts
  export interface QuickActionBarProps {
    showColorCodes: boolean
    showRulers: boolean
    onToggleColorCodes: () => void
    onToggleRulers: () => void
    onMirrorHorizontal: () => void
  }
  ```

- [ ] **Step 1: 在 `QuickActionBar.tsx` 中增加标尺切换按钮**

增加第 3 个胶囊按钮：
```tsx
<View
  className={`action-pill-btn toggle-ruler-btn ${showRulers ? 'active' : ''}`}
  onClick={onToggleRulers}
  hoverClass="btn-hover"
>
  <Text className="action-icon">📐</Text>
  <Text className="action-label">{showRulers ? '隐藏刻度' : '显示刻度'}</Text>
</View>
```

- [ ] **Step 2: 在 `QuickActionBar.scss` 中补充样式**

确保三个按钮并排时紧凑均匀自适应排列（`gap: 8px`，`padding: 5px 10px`）。

---

### Task 3: 在 `BeadCanvas` 中实现四周坐标刻度渲染与安全边界

**Files:**
- Modify: `src/components/BeadCanvas.tsx`

- [ ] **Step 1: 引入标尺计算并接收 `showRulers` prop**

导入 `getRulerBandSize, shouldShowRulerTickNumber, computeRulerFontSize`。
`BeadCanvasProps` 增加 `showRulers?: boolean`。

- [ ] **Step 2: 调整 `centerAndFitBoard` 与 `zoomAtPoint` 考虑标尺尺寸**

当 `showRulers === true` 时：
```ts
const rulerBand = getRulerBandSize(scaledCell, showRulers)
// 可用空间扣除两侧标尺
const availW = Math.max(80, w - (paddingX + rulerBand) * 2)
const availH = Math.max(80, h - (paddingY + rulerBand) * 2)
```
并在 `clampViewportBounds` 时将 `boardW` 和 `boardH` 计入 `rulerBand * 2`，保证标尺数字始终在画布视口内，不被截断。

- [ ] **Step 3: 在 `renderCanvas` 中绘制四周标尺**

1. 绘制网格前，如果 `showRulers === true`，绘制顶部、底部、左侧、右侧浅色标尺条背景。
2. 绘制每个单元格对应的列号与行号：
   - 顶部标尺：在 `cellX + scaledCell / 2, offsetY - rulerBand / 2` 绘制列序号；
   - 底部标尺：在 `cellX + scaledCell / 2, offsetY + boardH + rulerBand / 2` 绘制列序号；
   - 左侧标尺：在 `offsetX - rulerBand / 2, cellY + scaledCell / 2` 绘制行序号；
   - 右侧标尺：在 `offsetX + boardW + rulerBand / 2, cellY + scaledCell / 2` 绘制行序号；
   - 绘制每 5 格及 10 格的延伸刻度小标记。

---

### Task 4: 在 `IndexPage` 中接通 `showRulers` 状态

**Files:**
- Modify: `src/pages/index/index.tsx`

- [ ] **Step 1: 增加 `showRulers` 页面状态与切换逻辑**

```tsx
const [showRulers, setShowRulers] = useState(false)
const handleToggleRulers = useCallback(() => {
  setShowRulers(prev => !prev)
}, [])
```

- [ ] **Step 2: 传递给 `BeadCanvas` 与 `QuickActionBar`**

在 JSX 中传入 `showRulers` 与 `onToggleRulers`。

---

### Task 5: 全量回归测试与双端编译验证

- [ ] **Step 1: 运行全量单元测试**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：全部单测通过。

- [ ] **Step 2: 验证编译**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npm run build:weapp'`
运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npm run build:h5'`
预期：双端打包成功。
