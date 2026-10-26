# 拼豆小程序全面重构为 React 架构实施计划 (React Migration Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有拼豆小程序视图层与构建系统从 Vue 3 / Uni-app 重构为 **Taro + React 18 (TypeScript + TSX)**，保持所有核心色彩算法、色卡库、测试套件 100% 兼容，并产出可直接在微信开发者工具中运行的微信小程序产物。

**Architecture:** Taro React 18 架构。业务视图全面重构为 React 函数式组件与 Hooks，使用 `@tarojs/components` 进行多端抽象；核心色彩计算层（CIELAB $\Delta E_{2000}$、量化器、色卡等）作为无副作用的纯 TypeScript 核心库直接接入。

**Tech Stack:** Taro 4, React 18, TypeScript, TSX, SCSS, Vitest

## Global Constraints

- **Language & Runtime:** TypeScript / React 18, Node.js v20+ / v22+
- **Framework:** Taro React (`@tarojs/react`, `@tarojs/components`)
- **Algorithms & Palettes:** 100% 复用现有 `src/utils/` 与 `src/palettes/`，保持所有 25 项单测绿灯
- **Zero Vue Dependencies:** 彻底移除 Vue 相关依赖与 `.vue` 文件

---

### Task 1: 工程依赖与配置文件重构 (Taro React Scaffolding)

**Files:**
- Modify: `package.json`
- Create: `config/index.ts`
- Create: `config/dev.ts`
- Create: `config/prod.ts`
- Modify: `tsconfig.json`
- Modify: `src/app.config.ts`
- Create: `src/app.tsx`
- Create: `src/app.scss`
- Remove: `src/App.vue`, `src/main.ts`, `src/pages.json`, `src/manifest.json`

- [ ] **Step 1: 更新 `package.json` 替换为 Taro React 18 依赖与构建脚本**
- [ ] **Step 2: 配置 Taro 构建配置 `config/index.ts`**
- [ ] **Step 3: 创建 Taro 小程序入口文件 `src/app.tsx` 与路由配置 `src/app.config.ts`**
- [ ] **Step 4: 清理 Vue 相关入口与构建插件**
- [ ] **Step 5: 验证 Vitest 测试套件运行**
Run: `npm run test`
Expected: 25/25 PASS

---

### Task 2: BeadCanvas 组件重构为 React TSX (BeadCanvas.tsx)

**Files:**
- Create: `src/components/BeadCanvas.tsx`
- Remove: `src/components/BeadCanvas.vue`

- [ ] **Step 1: 编写 React 版 `BeadCanvas.tsx`**
使用 `forwardRef` + `useImperativeHandle`，实现视口矩阵、Frustum Culling 渲染、寻豆发光环与触控手势。
- [ ] **Step 2: 验证组件类型与手势逆矩阵集成**

---

### Task 3: 辅助交互组件重构为 React (ToolBar & ColorPaletteBar & ConfigModal)

**Files:**
- Create: `src/components/ToolBar.tsx`
- Create: `src/components/ColorPaletteBar.tsx`
- Create: `src/components/ConfigModal.tsx`
- Remove: `src/components/ToolBar.vue`, `src/components/ColorPaletteBar.vue`, `src/components/ConfigModal.vue`

- [ ] **Step 1: 实现 React 版 `ToolBar.tsx`**
- [ ] **Step 2: 实现 React 版 `ColorPaletteBar.tsx`（利用 Taro ScrollView 与数量统计）**
- [ ] **Step 3: 实现 React 版 `ConfigModal.tsx`（受控表单与规格切换）**

---

### Task 4: 主页面重构与数据流整合 (pages/index/index.tsx)

**Files:**
- Create: `src/pages/index/index.tsx`
- Create: `src/pages/index/index.scss`
- Create: `src/pages/index/index.config.ts`
- Remove: `src/pages/index/index.vue`

- [ ] **Step 1: 编写 React 版 `IndexPage`**
使用 `useState` 与 `useCallback` 统一编排图片解码、色彩量化、撤销重做栈、工具切换与施工图纸保存。
- [ ] **Step 2: 编写经典像素样图浮层选择组件**

---

### Task 5: 全量测试、微信小程序构建与推送到 GitHub

**Files:**
- Build output & Git commit

- [ ] **Step 1: 运行全量单元测试**
Run: `npm run test`
Expected: ALL PASS
- [ ] **Step 2: 编译微信小程序包**
Run: `npm run build:weapp`
Expected: 成功构建微信小程序工程
- [ ] **Step 3: 启动 H5 开发调试**
Run: `npm run dev:h5`
- [ ] **Step 4: 提交代码并推送到 GitHub 远程仓库 `yanhaoer/pindou-miniprogram`**
Run: `git push origin main`
