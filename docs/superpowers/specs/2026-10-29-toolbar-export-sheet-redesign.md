# 拼豆小程序：工具栏整行放大、下载图纸按钮下移与图纸样式对齐设计规范

## 1. 需求与目标概述

本设计旨在满足用户的三项核心交互与视觉优化需求：
1. **顶部工具栏整行自适应放大**：移除原顶部的“设置”与“导出”按键，将剩余的 7 个操作（5 个编辑工具：平移、画笔、填色、吸色、橡皮，以及 2 个历史操作：撤销、重做）通过均分网格撑满整行，图标与文字全面放大，便于手机端大拇指触控。
2. **设置入口迁移**：将移除的“设置”（底板尺寸与品牌色卡配置）移动至画布下方的快捷操作栏（`QuickActionBar`），保持 4 键平衡对称。
3. **“下载图纸”专属大按钮**：在图形信息卡片（`DrawingInfoCard`）下方新增一个醒目、大尺寸的“下载图纸”行动按钮，点击即生成高清图纸并保存相册。
4. **图纸输出对齐图2标准**：图纸导出重构，完全对齐用户提供的“图2”版式：
   - 顶部与左侧直接采用每 5 格标记坐标数字的刻度标尺（1, 6, 11, 16...）。
   - 拼豆以方块网格（Square cells）绘制，方块内部居中打印高对比度清晰色号。
   - 底部左侧绘制多列紧凑的“颜色清单：”方块色样与用量。
   - 底部右侧绘制小程序二维码及引导文案。

---

## 2. 详细设计与界面架构

### 2.1 顶部工具栏重构 (`ToolBar.tsx` & `ToolBar.scss`)
- **移除内容**：移除右侧的竖线分割符、设置按键（`gear`）与导出按键（`download`）。
- **布局升级**：
  - 工具栏容器采用 `width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 8px 6px;`。
  - 所有 7 个按键（平移、画笔、填色、吸色、橡皮、撤销、重做）统一作为一级操作项，采用 `flex: 1; min-width: 0;` 均分整行宽度。
  - 图标字号从 `19px` 放大到 `22px`，文字字号提升至 `12px` 并加粗显示（`font-weight: 600`）。
  - 选中高亮动画与按压微动效（`scale(0.93)`）保留。

### 2.2 快捷操作栏（`QuickActionBar.tsx`）增加设置按键
- `QuickActionBar` 扩展 `onOpenConfig?: () => void` 属性。
- 4 键横向排列：
  1. `🔢 色号`（显示/隐藏色号）
  2. `📏 刻度`（显示/隐藏坐标标尺）
  3. `🪞 镜像`（水平翻转）
  4. `⚙️ 设置`（弹出拼豆生成参数与品牌切换弹窗）

### 2.3 图形信息卡片与下载图纸大按钮 (`DrawingInfoCard` 下方)
- 在 [src/pages/index/index.tsx](file:///home/yhe/workplace/pindou-miniprogram/src/pages/index/index.tsx) 中，在 `DrawingInfoCard` 下方添加专属下载卡片：
  - 按钮样式：大号胶囊圆角，高度 `48px`，背景采用科技感蓝青渐变（`linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)`）。
  - 按钮文案：`📥 下载高清施工图纸`。
  - 下方带有小字说明：`长按可分享 · 自动保存至系统相册`。

### 2.4 图纸生成重构对齐“图2” (`exporter.ts`)
- **尺寸与间距计算 (`calculateSheetDimensions`)**：
  - 上方与左侧预留标尺空间 `rulerSize = 28px`，边距 `margin = 20px`。
  - 画板区域宽度 `gridW * cellSize`，高度 `gridH * cellSize`。
  - 下方区域高度根据颜色种类动态排布 `legendRows`，并预留右侧二维码宽度。
- **绘制流程 (`renderCraftSheet`)**：
  1. **背景**：纯白 `#FFFFFF`。
  2. **上方横向标尺**：仅标注 1, 6, 11, 16, 21, 26, 31... 及最后一列的列号。
  3. **左侧纵向标尺**：仅标注 1, 6, 11, 16, 21, 26, 31... 及最后一行的行号。
  4. **方块珠子绘制**：
     - 每个有效格子填充对应 HEX 色值矩形。
     - 细实线边框 `rgba(0, 0, 0, 0.15)`。
     - 中心文字：基于背景色亮度自动选取高对比度文字色（`#000000` 或 `#FFFFFF`），绘制清晰的色号代号（如 `E4`, `A01`）。
     - 每 5 格绘制加深网格线（`rgba(0, 0, 0, 0.45)`）。
  5. **底部颜色清单**：
     - 标题：“颜色清单：”。
     - 8 列紧凑网格（Square swatch + `${code} ${count}颗`）。
  6. **右下角小程序码**：
     - 加载并绘制已提取的小程序码图片（[src/assets/qrcode.png](file:///home/yhe/workplace/pindou-miniprogram/src/assets/qrcode.png) / [src/assets/qrcode.ts](file:///home/yhe/workplace/pindou-miniprogram/src/assets/qrcode.ts)）。
     - 下方标注“扫码转手残粉 / 点文免费·图纸自取”文案。

---

## 3. 验证计划

1. **单元测试验证**：
   - 补充并更新 [tests/utils/exporter.test.ts](file:///home/yhe/workplace/pindou-miniprogram/tests/utils/exporter.test.ts) 单测，验证标尺排版与方形单元格坐标计算。
   - 运行 `npx vitest run` 保证 100% 通过。
2. **构建验证**：
   - 运行 `npm run build:weapp` 验证小程序打包无误。
   - 运行 `npm run build:h5` 验证 H5 打包无误。
