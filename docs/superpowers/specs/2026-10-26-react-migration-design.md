# 拼豆小程序全面重构为 React 架构设计规范 (Design Spec)

## 1. 目标与背景 (Objectives)
将拼豆生成器小程序从原有的 Vue 3 / Uni-app 视图层全面迁移至 **Taro + React 18 + TypeScript + TSX** 现代化架构。
既提供原汁原味的 React 函数式组件生态体验（Hooks、TSX、声明式状态更新），又完整保留编译为微信小程序原生工程并在微信内运行的能力。

### 核心重构原则
1. **纯算法层 100% 保留与复用**：
   - 色彩空间转换 `src/utils/color-space.ts`
   - CIELAB $\Delta E_{2000}$ 算法 `src/utils/delta-e.ts`
   - 图像重采样与量化 `src/utils/quantizer.ts`
   - 视口与手势逆矩阵运算 `src/utils/gesture.ts`
   - 历史撤销栈与泛洪填充算法 `src/utils/history.ts`
   - 施工图纸排版与导出 `src/utils/exporter.ts`
   - 三大品牌官方色卡 `src/palettes/`
   - 样例数据 `src/assets/samples.ts`
   - 25 项全量 Vitest 单元测试套件保持 100% 通过。
2. **视图层全面重构为 React 18 TSX**：
   - 移除所有 `.vue` 单文件组件。
   - 使用标准 React 函数式组件与 Hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useImperativeHandle`)。
   - 组件使用 `@tarojs/components` (`View`, `Canvas`, `ScrollView`, `Text`, `Switch`, `Input`)。

---

## 2. React 组件拆分与状态设计

### 2.1 组件树架构
```
App (Taro Root)
└── IndexPage (主页面 - 状态编排)
    ├── TopNav (顶栏: 标题、样例、选图、导出)
    ├── ToolBar (微调工具栏: 平移/铅笔/油漆桶/吸管/橡皮/撤销/重做/设置)
    ├── BeadCanvas (Canvas 2D 核心画布: useRef + 手势 + 寻豆高亮)
    ├── ColorPaletteBar (底部色号清单: ScrollView + 统计 + 寻豆选择)
    ├── ConfigModal (规格与算法设置浮层)
    └── SamplePickerModal (经典像素样图选择浮层)
```

### 2.2 核心状态定义
```typescript
interface AppState {
  grid: BeadCell[][]
  currentBrand: BeadBrand // 'artkal' | 'perler' | 'mard'
  boardWidth: number
  boardHeight: number
  useDither: boolean
  currentTool: EditTool // 'view' | 'pencil' | 'bucket' | 'eyedropper' | 'eraser'
  selectedColorCode: string | null // 寻豆高亮色号
  activeColor: BeadColor | null // 当前画笔激活颜色
  colorStats: Map<string, BeadColorStatItem>
  history: HistoryManager
}
```

### 2.3 BeadCanvas (React 2D 画布)
- 使用 `forwardRef` 配合 `useImperativeHandle` 暴露 `resetView()` 与 `render()`。
- 使用 `useRef` 保存视口变换与拖拽坐标，避免无谓的 React re-render 损耗帧率，直接在 Canvas 2D 上下文中实现 60fps 的流畅缩放与平移。
- 监听 `grid` 与 `selectedColorCode` 更新自动触发微任务重新绘制。

---

## 3. 工程配置迁移
- 替换 `package.json` 中的 Vue 依赖为 React 18、`@tarojs/taro`、`@tarojs/react`、`@tarojs/components` 等标准依赖。
- 配置 `config/index.ts` 支持 Taro 编译至 `weapp` (微信小程序) 与 `h5` (浏览器)。
