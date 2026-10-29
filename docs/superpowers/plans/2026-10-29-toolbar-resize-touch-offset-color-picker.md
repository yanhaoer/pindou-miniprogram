# 拼豆小程序：工具栏放大、触控偏移修复与全量色号选择抽屉实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 放大顶部微调工具栏触控区域、消除画板方块点击位置偏移、并在画笔点击方块时弹出全量色号底部抽屉供用户选取更换颜色。

**Architecture:**
1. 在 `src/utils/gesture.ts` 中补充画布视口相对坐标转换工具函数并编写单元测试，解决小程序画布缺乏 `getBoundingClientRect` 导致的偏移。
2. 在 `src/components/ToolBar.scss` 中放大按键尺寸、图标及文本字号，适配移动端大拇指触控。
3. 创建全量色号底部抽屉组件 `src/components/FullColorPickerSheet.tsx`，支持色系筛选与色号搜索，基于 `<RootPortal>` 防 Native Canvas 层穿透。
4. 在 `BeadCanvas.tsx` 中接入自适应矩形测量，并在 `IndexPage` 中联动点击方块事件与全量色号选择抽屉。

**Tech Stack:** Taro 4.3 (React 18), TypeScript, SCSS, Vitest

## Global Constraints

- 不可破坏现有导出高清图纸、历史撤销重做（Undo/Redo）、水平镜像与坐标刻度展示功能。
- 坐标换算必须兼顾微信小程序环境与 Web/H5 浏览器环境。
- 全量色号选择抽屉必须采用 `<RootPortal enable>` 独立容器挂载，防止被同级原生 Canvas 2D 遮挡。
- 测试必须使用 `bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'` 运行验证。

---

### Task 1: 触控相对坐标计算工具函数及单元测试

**Files:**
- Modify: `src/utils/gesture.ts`
- Modify: `tests/utils/gesture.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function getCanvasRelativeCoords(
    touch: { x?: number; y?: number; clientX?: number; clientY?: number },
    canvasRect: { left: number; top: number }
  ): { x: number; y: number }
  ```

- [x] **Step 1: 编写相对坐标计算单元测试**

在 `tests/utils/gesture.test.ts` 中添加测试用例：
```ts
describe('getCanvasRelativeCoords', () => {
  it('prefers touch.x and touch.y when they are defined numbers', () => {
    const touch = { x: 45, y: 80, clientX: 100, clientY: 220 }
    const rect = { left: 55, top: 140 }
    expect(getCanvasRelativeCoords(touch, rect)).toEqual({ x: 45, y: 80 })
  })

  it('calculates relative coords using clientX/clientY minus rect left/top when touch.x/y undefined', () => {
    const touch = { clientX: 120, clientY: 250 }
    const rect = { left: 20, top: 100 }
    expect(getCanvasRelativeCoords(touch, rect)).toEqual({ x: 100, y: 150 })
  })

  it('handles negative or boundary values properly', () => {
    const touch = { clientX: 10, clientY: 50 }
    const rect = { left: 20, top: 100 }
    expect(getCanvasRelativeCoords(touch, rect)).toEqual({ x: -10, y: -50 })
  })
})
```

- [x] **Step 2: 运行单测验证失败**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/gesture.test.ts'`
预期：FAIL（`getCanvasRelativeCoords` 未定义）

- [x] **Step 3: 在 `src/utils/gesture.ts` 中实现 `getCanvasRelativeCoords`**

```ts
/**
 * 获取相对于画布内部的原生像素坐标
 * 优先采用小程序 TouchEvent 自带的相对坐标 touch.x / touch.y；
 * 若未提供则使用 client 坐标减去由 SelectorQuery 测出的 canvasRect.left / canvasRect.top。
 */
export function getCanvasRelativeCoords(
  touch: { x?: number; y?: number; clientX?: number; clientY?: number },
  canvasRect: { left: number; top: number }
): { x: number; y: number } {
  if (typeof touch.x === 'number' && typeof touch.y === 'number') {
    return { x: touch.x, y: touch.y }
  }
  const clientX = typeof touch.clientX === 'number' ? touch.clientX : 0
  const clientY = typeof touch.clientY === 'number' ? touch.clientY : 0
  return {
    x: clientX - (canvasRect.left || 0),
    y: clientY - (canvasRect.top || 0)
  }
}
```

- [x] **Step 4: 运行单测验证通过**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/gesture.test.ts'`
预期：PASS

---

### Task 2: 顶部工具栏（ToolBar）移动端放大优化

**Files:**
- Modify: `src/components/ToolBar.scss`
- Modify: `src/components/ToolBar.tsx`

**Interfaces:**
- Consumes: `ToolBarProps` (保持接口不变，扩展样式层级与尺寸)

- [x] **Step 1: 更新 `ToolBar.scss` 尺寸样式**

在 `src/components/ToolBar.scss` 中调整以下尺寸：
```scss
.toolbar-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  min-height: 56px;
  background: #18191f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 52px;

  &.active {
    background: #3b82f6;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.55);

    .label {
      color: #ffffff;
      font-weight: bold;
    }
  }

  &:active {
    transform: scale(0.94);
  }

  .icon {
    font-size: 19px;
  }

  .label {
    font-size: 11px;
    color: #cfd3dc;
    margin-top: 2px;
    font-weight: 500;
  }
}

.action-group {
  display: flex;
  align-items: center;
  gap: 7px;
}

.action-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s ease;

  &:active {
    transform: scale(0.93);
  }

  &.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &.export-btn {
    background: rgba(56, 189, 248, 0.18);
    border: 1px solid rgba(56, 189, 248, 0.35);

    &:active {
      background: rgba(56, 189, 248, 0.32);
    }
  }
}

.action-icon {
  font-size: 17px;
}
```

- [x] **Step 2: 验证样式构建与单测无回归**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：PASS

---

### Task 3: 全量色号选择器底部抽屉组件 (`FullColorPickerSheet`)

**Files:**
- Create: `src/components/FullColorPickerSheet.tsx`
- Create: `src/components/FullColorPickerSheet.scss`
- Create: `tests/utils/color-filter.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface FullColorPickerSheetProps {
    visible: boolean
    brand: BeadBrand
    targetPos: { x: number; y: number } | null
    currentCellColor?: BeadColor | null
    inUseColors?: BeadColor[]
    onClose: () => void
    onSelectColor: (color: BeadColor, pos: { x: number; y: number }) => void
  }
  ```

- [x] **Step 1: 编写色彩分类与过滤纯函数单元测试**

在 `tests/utils/color-filter.test.ts` 中编写测试：
```ts
import { describe, it, expect } from 'vitest'
import { filterBeadColors, COLOR_CATEGORIES } from '@/utils/color-filter'
import type { BeadColor } from '@/palettes/types'

const mockColors: BeadColor[] = [
  { code: 'A01', name: '大红色', hex: '#E60012', r: 230, g: 0, b: 18, lab: [48, 75, 54], brand: 'artkal' },
  { code: 'A02', name: '柠檬黄', hex: '#FFF100', r: 255, g: 241, b: 0, lab: [93, -12, 88], brand: 'artkal' },
  { code: 'A03', name: '天蓝色', hex: '#00A0E9', r: 0, g: 160, b: 233, lab: [62, -10, -50], brand: 'artkal' },
  { code: 'A04', name: '纯黑色', hex: '#000000', r: 0, g: 0, b: 0, lab: [0, 0, 0], brand: 'artkal' }
]

describe('Color Filter System', () => {
  it('filters by search keyword in code or name', () => {
    const res = filterBeadColors(mockColors, { search: '大红' })
    expect(res.length).toBe(1)
    expect(res[0].code).toBe('A01')

    const res2 = filterBeadColors(mockColors, { search: 'A03' })
    expect(res2.length).toBe(1)
    expect(res2[0].code).toBe('A03')
  })

  it('filters by category', () => {
    const redRes = filterBeadColors(mockColors, { category: '红色粉色' })
    expect(redRes.some(c => c.code === 'A01')).toBe(true)
  })
})
```

- [x] **Step 2: 创建 `src/utils/color-filter.ts` 并运行单测验证通过**

实现色系归类与搜索函数：
```ts
import type { BeadColor } from '@/palettes/types'

export const COLOR_CATEGORIES = [
  '全部',
  '图中在用',
  '红色粉色',
  '黄色橙色',
  '绿色系',
  '蓝色青色',
  '紫色系',
  '黑白灰色'
] as const

export type ColorCategory = typeof COLOR_CATEGORIES[number]

export function filterBeadColors(
  colors: BeadColor[],
  options: {
    search?: string
    category?: ColorCategory
    inUseColors?: BeadColor[]
  }
): BeadColor[] {
  const { search = '', category = '全部', inUseColors = [] } = options
  let result = colors

  if (category === '图中在用') {
    result = inUseColors
  } else if (category === '红色粉色') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return (h <= 20 || h >= 330) && s > 0.15 && l > 0.15
    })
  } else if (category === '黄色橙色') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return h > 20 && h <= 65 && s > 0.15 && l > 0.15
    })
  } else if (category === '绿色系') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return h > 65 && h <= 170 && s > 0.15 && l > 0.15
    })
  } else if (category === '蓝色青色') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return h > 170 && h <= 260 && s > 0.15 && l > 0.15
    })
  } else if (category === '紫色系') {
    result = colors.filter(c => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      return h > 260 && h < 330 && s > 0.15 && l > 0.15
    })
  } else if (category === '黑白灰色') {
    result = colors.filter(c => {
      const [, s, l] = rgbToHsl(c.r, c.g, c.b)
      return s <= 0.15 || l <= 0.15 || l >= 0.90
    })
  }

  const query = search.trim().toLowerCase()
  if (query) {
    result = result.filter(c =>
      c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
    )
  }

  return result
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h *= 60
  }
  return [h, s, l]
}
```

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/color-filter.test.ts'`
预期：PASS

- [x] **Step 3: 实现 `FullColorPickerSheet.tsx` 与 `FullColorPickerSheet.scss`**

包含：
1. `<RootPortal enable>` 独立容器防 Native 层遮挡；
2. 顶部原方块坐标与当前颜色展示；
3. 搜索框与色系横向滚轮胶囊；
4. 4 列色块网格卡片（色块 + 色号代码 + 颜色名称）；
5. 点击触发回调并退出。

---

### Task 4: `BeadCanvas` 触控偏移修复与点击事件打通

**Files:**
- Modify: `src/components/BeadCanvas.tsx`

- [x] **Step 1: 在 `BeadCanvas` 挂载及触控时捕获精确 `boundingClientRect`**

在 `BeadCanvas.tsx` 中：
```ts
const canvasRectRef = useRef({ left: 0, top: 0, width: 360, height: 480 })

const updateCanvasRect = useCallback(() => {
  const query = Taro.createSelectorQuery()
  query.select('#beadCanvas').boundingClientRect((rect: any) => {
    if (rect) {
      canvasRectRef.current = {
        left: rect.left || 0,
        top: rect.top || 0,
        width: rect.width || 360,
        height: rect.height || 480
      }
    }
  }).exec()
}, [])
```
在画布就绪及 `handleTouchStart` 中调用 `updateCanvasRect()`。

- [x] **Step 2: 在 `handleCellTap` 中使用 `getCanvasRelativeCoords` 计算相对坐标**

```ts
const handleCellTap = useCallback((touchOrEvent: any) => {
  if (!grid || grid.length === 0) return

  const rel = getCanvasRelativeCoords(touchOrEvent, canvasRectRef.current)
  const pos = screenToGrid(
    rel.x,
    rel.y,
    viewportRef.current,
    baseCellSize,
    grid[0].length,
    grid.length
  )

  if (pos && onCellClick) {
    const cell = grid[pos.gridY][pos.gridX]
    onCellClick({ x: pos.gridX, y: pos.gridY, cell })
  }
}, [grid, baseCellSize, onCellClick])
```

- [x] **Step 3: 运行全量单测验证**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：PASS

---

### Task 5: `IndexPage` 状态打通与全量选色联动

**Files:**
- Modify: `src/pages/index/index.tsx`

- [x] **Step 1: 引入 `FullColorPickerSheet` 并增加选中弹窗状态**

在 `src/pages/index/index.tsx` 中：
```tsx
const [showFullColorPicker, setShowFullColorPicker] = useState(false)
const [colorPickerTargetPos, setColorPickerTargetPos] = useState<{ x: number; y: number } | null>(null)
```

- [x] **Step 2: 修改 `handleCellClick` 中的 `pencil` 行为**

```tsx
if (currentTool === 'pencil') {
  setColorPickerTargetPos({ x, y })
  setShowFullColorPicker(true)
  return
}
```

- [x] **Step 3: 实现选色回调 `handleSelectFullColor`**

```tsx
const handleSelectFullColor = useCallback((selectedColor: BeadColor, pos: { x: number; y: number }) => {
  setGrid(prev => {
    const next = prev.map(row => row.map(c => ({ ...c })))
    next[pos.y][pos.x].color = { ...selectedColor }
    next[pos.y][pos.x].isEmpty = false
    setColorStats(getBeadColorStats(next))
    historyRef.current.pushState(next)
    updateHistoryState()
    return next
  })
  setActiveColor(selectedColor)
  setSelectedColorCode(selectedColor.code)
  setShowFullColorPicker(false)
  Taro.showToast({
    title: `已更改 (${pos.x + 1}, ${pos.y + 1}) 为 ${selectedColor.code}`,
    icon: 'none',
    duration: 1500
  })
}, [updateHistoryState])
```

- [x] **Step 4: 在 JSX 中渲染 `FullColorPickerSheet`**

```tsx
<FullColorPickerSheet
  visible={showFullColorPicker}
  brand={currentBrand}
  targetPos={colorPickerTargetPos}
  currentCellColor={
    colorPickerTargetPos && grid[colorPickerTargetPos.y]
      ? grid[colorPickerTargetPos.y][colorPickerTargetPos.x]?.color
      : null
  }
  inUseColors={Array.from(colorStats.values()).map(s => s.color)}
  onClose={() => setShowFullColorPicker(false)}
  onSelectColor={handleSelectFullColor}
/>
```

---

### Task 6: 全量单元测试与双端编译验证

- [x] **Step 1: 运行全量单元测试**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run'`
预期：全部单元测试 100% 通过。

- [x] **Step 2: 微信小程序编译验证**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npm run build:weapp'`
预期：Webpack 编译成功，`dist/` 产物完整。

- [x] **Step 3: H5 编译验证**

运行：`bash -c 'source ~/.nvm/nvm.sh && nvm use 20 && npm run build:h5'`
预期：编译输出至 `dist-h5/`，不影响 `dist/` 小程序目录。
