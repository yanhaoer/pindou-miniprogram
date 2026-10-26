# 拼豆生成器小程序 (Pindou Mini-Program) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Uni-app (Vue 3 + Vite + TypeScript) 的微信小程序拼豆生成器，支持图片像素化、高保真 CIELAB $\Delta E_{2000}$ 色彩匹配主流色卡（Artkal/Perler/漫拼）、手势缩放平移、逼真立体珠子微孔质感、智能寻豆高亮以及带坐标标尺与用量统计的高清施工图纸导出。

**Architecture:** 纯前端与小程序离屏处理架构。色彩引擎通过转换矩阵与 CIELAB $\Delta E_{2000}$ 算法完成像素量化与 Floyd-Steinberg 误差扩散；视图层基于 Canvas 2D 进行高性能视口变换、视锥剔除与多图层渲染；最后通过离屏 Canvas 生成带行列标尺与用量统计的高清图纸并保存到相册。

**Tech Stack:** Uni-app (Vue 3), Vite, TypeScript, Canvas 2D API, Vitest (单元测试)

## Global Constraints

- **Language & Runtime:** TypeScript / ES2022, Node.js v20+ / v22+
- **Framework:** Uni-app Vue 3 (Vite 驱动)
- **Canvas API:** 微信小程序 Canvas 2.0 (`<canvas type="2d">`)，同时平滑降级支持 Web H5 `<canvas>`
- **No Heavy Backend Dependencies:** 所有图像处理、色卡匹配与图纸导出均在前端/客户端运行

---

### Task 1: 项目工程脚手架与基础构建配置 (Project Scaffolding)

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/pages/index/index.vue`
- Create: `src/manifest.json`
- Create: `src/pages.json`
- Test: `vitest.config.ts`

**Interfaces:**
- Produces: 能够运行 `npm run dev:h5`（本地浏览器极速预览）与 `npm run build:mp-weixin`（编译为微信小程序）的基础工程体系。

- [ ] **Step 1: 创建 `package.json` 与核心依赖**
定义 Uni-app Vue3、Vite、TypeScript 与 Vitest 基础配置。
- [ ] **Step 2: 创建 `tsconfig.json` 与 `vite.config.ts`**
配置 Uni-app Vite 插件与路径别名 `@/`。
- [ ] **Step 3: 创建 `src/manifest.json` 与 `src/pages.json`**
配置微信小程序 appid 占位、页面路由 `pages/index/index` 与导航栏样式。
- [ ] **Step 4: 安装依赖并验证 H5 运行与 Vitest 测试环境**
Run: `npm install && npm run test`
Expected: 依赖安装成功，测试套件就绪。
- [ ] **Step 5: 提交基础代码**
```bash
git add .
git commit -m "chore: scaffold uni-app vue3 project with vite and typescript"
```

---

### Task 2: 色彩空间转换与 CIELAB Delta E 2000 核心算法库 (Color Space & Delta-E)

**Files:**
- Create: `src/utils/color-space.ts`
- Create: `src/utils/delta-e.ts`
- Test: `tests/utils/color-space.test.ts`
- Test: `tests/utils/delta-e.test.ts`

**Interfaces:**
- Produces:
  - `rgbToXyz(r: number, g: number, b: number): [number, number, number]`
  - `xyzToLab(x: number, y: number, z: number): [number, number, number]`
  - `rgbToLab(r: number, g: number, b: number): [number, number, number]`
  - `deltaE2000(lab1: [number, number, number], lab2: [number, number, number]): number`

- [ ] **Step 1: 编写色彩空间转换与 Delta E 2000 的失败测试**
覆盖 RGB 转 Lab（如纯黑、纯白、红、绿、蓝）与已知的标准 CIELAB $\Delta E_{2000}$ 测试样例。
- [ ] **Step 2: 运行测试验证失败**
Run: `npx vitest run tests/utils/color-space.test.ts`
Expected: FAIL ("cannot find module")
- [ ] **Step 3: 实现 `src/utils/color-space.ts`**
实现 sRGB 反向 Gamma 矫正、矩阵变换至 CIE XYZ (D65 标准光源)，再转换至 CIE $L^*a^*b^*$。
- [ ] **Step 4: 实现 `src/utils/delta-e.ts`**
实现完整的 CIELAB $\Delta E_{2000}$ 算法（含 $S_L, S_C, S_H, R_T$ 旋转项），确保计算精确度。
- [ ] **Step 5: 运行测试验证全部通过**
Run: `npx vitest run tests/utils/`
Expected: PASS (所有色彩空间与 Delta-E 测试通过)
- [ ] **Step 6: 提交代码**
```bash
git add src/utils/ tests/utils/
git commit -m "feat: implement color-space conversions and cielab delta-e 2000 algorithm"
```

---

### Task 3: 主流拼豆品牌色卡库 (Artkal, Perler, 漫拼 Mard)

**Files:**
- Create: `src/palettes/types.ts`
- Create: `src/palettes/artkal.ts`
- Create: `src/palettes/perler.ts`
- Create: `src/palettes/mard.ts`
- Create: `src/palettes/index.ts`
- Test: `tests/palettes/palettes.test.ts`

**Interfaces:**
- Consumes: `rgbToLab` from `src/utils/color-space.ts`
- Produces:
  - `interface BeadColor { code: string; name: string; hex: string; r: number; g: number; b: number; lab: [number, number, number]; brand: 'artkal' | 'perler' | 'mard'; }`
  - `interface BeadPalette { id: string; name: string; colors: BeadColor[]; }`
  - `getPalette(brandId: string): BeadPalette`

- [ ] **Step 1: 编写色卡加载与色彩结构验证测试**
验证 Artkal、Perler、Mard 色卡数据完整性、Hex 格式规范性及预编译 Lab 值的正确性。
- [ ] **Step 2: 运行测试验证失败**
Run: `npx vitest run tests/palettes/`
Expected: FAIL
- [ ] **Step 3: 定义 `src/palettes/types.ts` 与三套品牌官方色卡数据**
收集并整理主流色号 RGB 与中英文名称，并在模块初始化时自动为每种颜色计算并缓存 Lab 坐标。
- [ ] **Step 4: 实现 `src/palettes/index.ts` 聚合与切换逻辑**
提供快速按品牌获取色卡与查找色号的 API。
- [ ] **Step 5: 运行测试验证全部通过**
Run: `npx vitest run tests/palettes/`
Expected: PASS
- [ ] **Step 6: 提交代码**
```bash
git add src/palettes/ tests/palettes/
git commit -m "feat: add comprehensive bead palettes for artkal, perler, and mard"
```

---

### Task 4: 图像重采样、色彩量化与 Floyd-Steinberg 误差扩散引擎 (Quantizer)

**Files:**
- Create: `src/utils/quantizer.ts`
- Test: `tests/utils/quantizer.test.ts`

**Interfaces:**
- Consumes:
  - `deltaE2000` from `src/utils/delta-e.ts`
  - `rgbToLab` from `src/utils/color-space.ts`
  - `BeadColor`, `BeadPalette` from `src/palettes/`
- Produces:
  - `interface BeadCell { x: number; y: number; color: BeadColor; isEmpty: boolean; }`
  - `interface QuantizeOptions { width: number; height: number; dither: boolean; palette: BeadPalette; }`
  - `quantizeImageData(pixels: Uint8ClampedArray, imgWidth: number, imgHeight: number, options: QuantizeOptions): BeadCell[][]`
  - `getBeadColorStats(grid: BeadCell[][]): Map<string, { color: BeadColor; count: number }>`

- [ ] **Step 1: 编写量化器测试用例**
测试图像缩放、最邻近匹配、无抖动与误差扩散抖动、以及用量统计汇总。
- [ ] **Step 2: 运行测试验证失败**
Run: `npx vitest run tests/utils/quantizer.test.ts`
Expected: FAIL
- [ ] **Step 3: 实现双线性插值降采样与 CIELAB 最佳颜色匹配**
- [ ] **Step 4: 实现 Floyd-Steinberg 误差扩散缓冲与残差分发逻辑**
- [ ] **Step 5: 实现色号使用量聚合统计器 `getBeadColorStats`**
- [ ] **Step 6: 运行测试验证全部通过**
Run: `npx vitest run tests/utils/quantizer.test.ts`
Expected: PASS
- [ ] **Step 7: 提交代码**
```bash
git add src/utils/quantizer.ts tests/utils/quantizer.test.ts
git commit -m "feat: implement image quantizer and floyd-steinberg dithering engine"
```

---

### Task 5: 核心拼豆 Canvas 2D 手势渲染组件 (BeadCanvas)

**Files:**
- Create: `src/components/BeadCanvas.vue`
- Create: `src/utils/gesture.ts`
- Test: `tests/utils/gesture.test.ts`

**Interfaces:**
- Consumes: `BeadCell[][]` from `src/utils/quantizer.ts`
- Produces:
  - 微信小程序 `<canvas type="2d">` 与 H5 双环境手势视口变换器（单指拖动平移、双指捏合缩放）
  - 逼真圆珠材质渲染（外圈高光径向渐变、中心插孔、网格虚线、坐标指示器）
  - “寻豆”高亮模式（暗淡非选中豆子，高亮闪烁/发光边框标出选中色号所有豆子）
  - 支持单点坐标拾取（将屏幕触控点反向转换为网格坐标 `(gridX, gridY)`）

- [ ] **Step 1: 编写手势变换计算单测**
测试屏幕坐标到网格坐标的逆矩阵变换、缩放边界限制（0.5x ~ 10x）及两指间距比例算法。
- [ ] **Step 2: 实现 `src/utils/gesture.ts`**
- [ ] **Step 3: 实现 `src/components/BeadCanvas.vue` 模板与生命周期适配**
兼容 `uni.createSelectorQuery()` 获取 Canvas 2D 实例，绑定 `touchstart`, `touchmove`, `touchend`。
- [ ] **Step 4: 实现高帧率材质渲染流水线与视锥剔除优化**
- [ ] **Step 5: 实现寻豆高亮图层与非选中区域遮罩逻辑**
- [ ] **Step 6: 验证组件渲染与手势交互**
- [ ] **Step 7: 提交代码**
```bash
git add src/components/BeadCanvas.vue src/utils/gesture.ts tests/utils/gesture.test.ts
git commit -m "feat: implement high-performance canvas 2d bead renderer with gesture system"
```

---

### Task 6: 微调工具箱与底部寻豆清单面板 (ToolBar & PaletteBar)

**Files:**
- Create: `src/components/ToolBar.vue`
- Create: `src/components/ColorPaletteBar.vue`
- Create: `src/utils/history.ts`
- Test: `tests/utils/history.test.ts`

**Interfaces:**
- Consumes: `BeadCell[][]`, `selectedColorCode`
- Produces:
  - 工具栏状态：画笔 (Pencil)、油漆桶 (Bucket)、吸管 (Eyedropper)、橡皮擦 (Eraser)、撤销/重做 (Undo/Redo)
  - 底部滚动色号清单：展示当前图纸包含的所有色号色块、编号、名称、使用颗数，点击切换高亮或激活画笔颜色
  - 历史栈状态管理器 `HistoryManager`（支持 20 步回退）

- [ ] **Step 1: 编写历史操作栈与油漆桶连通区域填充单测**
- [ ] **Step 2: 实现 `src/utils/history.ts` 历史栈**
- [ ] **Step 3: 实现 `src/components/ToolBar.vue` 交互面板**
- [ ] **Step 4: 实现 `src/components/ColorPaletteBar.vue` 底部抽屉与色号统计条**
- [ ] **Step 5: 验证工具交互响应与色号联动**
- [ ] **Step 6: 提交代码**
```bash
git add src/components/ src/utils/history.ts tests/utils/history.test.ts
git commit -m "feat: add manual editing tools and interactive bead palette bar"
```

---

### Task 7: 施工图纸离屏渲染与微信相册导出引擎 (Exporter & UI Integration)

**Files:**
- Create: `src/utils/exporter.ts`
- Create: `src/components/ConfigModal.vue`
- Create: `src/assets/samples.ts`
- Modify: `src/pages/index/index.vue`
- Test: `tests/utils/exporter.test.ts`

**Interfaces:**
- Consumes: `BeadCell[][]`, `BeadPalette`, `BeadColorStats`
- Produces:
  - 离屏超清图纸生成器：外围行列 1~N 数字刻度标尺、拼豆网格、底部小票式色号用量清单排版
  - 微信原生相册保存：`uni.canvasToTempFilePath` + `uni.saveImageToPhotosAlbum`（含权限弹窗引导）
  - 首页完整功能闭环：图片上传/拍照、精选趣味样图一键加载、底板规格调整、一键导出

- [ ] **Step 1: 编写图纸排版尺寸计算与清单布局测试**
- [ ] **Step 2: 实现 `src/utils/exporter.ts` 离屏渲染与图片导出**
- [ ] **Step 3: 实现 `src/components/ConfigModal.vue` 参数配置弹窗**
- [ ] **Step 4: 整合 `src/pages/index/index.vue` 主工作台完整数据流与样式**
- [ ] **Step 5: 内置 4~6 款精美像素样例图片数据**
- [ ] **Step 6: 提交代码**
```bash
git add src/ utils/ tests/
git commit -m "feat: complete export engine, config modal, and index page integration"
```

---

### Task 8: 全面验证与多端构建测试 (Verification & Build Check)

**Files:**
- None (Test & Build outputs)

**Interfaces:**
- 确保测试套件 100% 通过，H5 与 微信小程序端产物均可正常编译无任何告警/报错。

- [ ] **Step 1: 运行全量单元测试**
Run: `npm run test`
Expected: ALL PASS
- [ ] **Step 2: 编译微信小程序产物**
Run: `npm run build:mp-weixin`
Expected: 成功输出 `dist/build/mp-weixin` 目录，无报错。
- [ ] **Step 3: 启动 H5 开发预览并检查界面美观度与交互**
Run: `npm run dev:h5`
- [ ] **Step 4: 最终提交**
```bash
git commit -am "chore: finish bead generator mini-program implementation and pass all builds"
```
