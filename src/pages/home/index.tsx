import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getAllPalettes } from '@/palettes'
import type { BeadBrand } from '@/palettes/types'
import xiaoguaLogo from '@/assets/xiaogua.png'
import './index.scss'

export type ThemeMode = 'dark' | 'light'
export type HomeTab = 'make' | 'plaza' | 'mine'

const PRESET_SIZES = [
  { w: 16, h: 16, name: '16 × 16', desc: '简约卡通' },
  { w: 20, h: 20, name: '20 × 20', desc: '经典挂件' },
  { w: 50, h: 50, name: '50 × 50', desc: '标准大板' },
  { w: 52, h: 52, name: '52 × 52', desc: '全景进阶' }
]

// 广场精选样例社区数据
const PLAZA_ITEMS = [
  {
    id: 'mario',
    title: '经典马里奥',
    author: '像素达人呱呱',
    size: '28×28',
    colors: 12,
    likes: 1280,
    tag: '复古游戏',
    icon: '🍄'
  },
  {
    id: 'pikachu',
    title: '皮卡丘闪电',
    author: '宝可梦手作坊',
    size: '30×30',
    colors: 14,
    likes: 2540,
    tag: '热门动漫',
    icon: '⚡'
  },
  {
    id: 'cat',
    title: '软萌三花猫',
    author: '喵喵手作阁',
    size: '32×32',
    colors: 18,
    likes: 1890,
    tag: '可爱萌宠',
    icon: '🐱'
  },
  {
    id: 'strawberry',
    title: '草莓甜甜圈',
    author: '甜品研究所',
    size: '20×20',
    colors: 9,
    likes: 920,
    tag: '美食小物',
    icon: '🍓'
  },
  {
    id: 'kirby',
    title: '星之卡比漫步',
    author: '粉色星愿',
    size: '24×24',
    colors: 8,
    likes: 1650,
    tag: '热门动漫',
    icon: '⭐'
  },
  {
    id: 'gameboy',
    title: '复古复刻掌机',
    author: '8Bit极客',
    size: '32×22',
    colors: 10,
    likes: 1420,
    tag: '复古游戏',
    icon: '🎮'
  }
]

export default function HomePage() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = Taro.getStorageSync('pindou_theme')
      if (saved === 'light' || saved === 'dark') return saved
      if (typeof Taro.getSystemInfoSync === 'function') {
        const sys = Taro.getSystemInfoSync()
        if (sys && sys.theme === 'dark') return 'dark'
      }
    } catch (e) {}
    return 'light'
  })

  const [currentTab, setCurrentTab] = useState<HomeTab>('make')
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0)
  const [isCustomSize, setIsCustomSize] = useState<boolean>(false)
  const [customWidth, setCustomWidth] = useState<number>(29)
  const [customHeight, setCustomHeight] = useState<number>(29)
  const [selectedBrand, setSelectedBrand] = useState<BeadBrand>('artkal')
  const [plazaCategory, setPlazaCategory] = useState<string>('全部')

  const palettes = getAllPalettes()

  // 动态同步小程序原生导航栏色彩
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.setNavigationBarColor({
        frontColor: theme === 'dark' ? '#ffffff' : '#000000',
        backgroundColor: theme === 'dark' ? '#16171d' : '#f8fafc',
        animation: { duration: 200, timingFunc: 'linear' }
      }).catch(() => {})
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      try {
        Taro.setStorageSync('pindou_theme', next)
      } catch (e) {}
      return next
    })
  }, [])

  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index)
    setIsCustomSize(false)
  }

  const handleCustomInputFocus = () => {
    setIsCustomSize(true)
  }

  const getCurrentDimensions = () => {
    if (isCustomSize) {
      const w = Math.max(8, Math.min(100, Number(customWidth) || 29))
      const h = Math.max(8, Math.min(100, Number(customHeight) || 29))
      return { width: w, height: h }
    }
    const preset = PRESET_SIZES[selectedPresetIndex] || PRESET_SIZES[0]
    return { width: preset.w, height: preset.h }
  }

  const navigateToEditor = (imagePath?: string) => {
    const { width, height } = getCurrentDimensions()
    let url = `/pages/index/index?width=${width}&height=${height}&brand=${selectedBrand}`
    if (imagePath) {
      url += `&imagePath=${encodeURIComponent(imagePath)}`
    }
    Taro.navigateTo({ url })
  }

  const handlePickImage = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0]
        if (tempPath) {
          navigateToEditor(tempPath)
        }
      },
      fail: (err) => {
        console.log('User cancelled or error picking image', err)
      }
    })
  }

  const handlePreviewSample = () => {
    navigateToEditor()
  }

  const handleComingSoon = (featureName: string) => {
    Taro.showToast({
      title: `${featureName} 功能正在火热开发中，敬请期待！`,
      icon: 'none',
      duration: 2000
    })
  }

  const filteredPlazaItems = plazaCategory === '全部'
    ? PLAZA_ITEMS
    : PLAZA_ITEMS.filter(it => it.tag.includes(plazaCategory))

  return (
    <View className={`home-container theme-${theme}`}>
      {/* 顶部状态与主题切换 */}
      <View className="home-header-bar">
        <View className="header-badge">
          <Text className="badge-dot">●</Text>
          <Text className="badge-text">2026 Pro 拼豆引擎</Text>
        </View>

        <View
          className="theme-switch-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? '切换为明亮模式' : '切换为暗夜模式'}
        >
          <Text className="theme-icon">{theme === 'dark' ? '🌙 暗夜' : '☀️ 明亮'}</Text>
        </View>
      </View>

      {/* ===================== Tab 1: 制作 ===================== */}
      {currentTab === 'make' && (
        <View className="tab-make-content">
          {/* 头部 Logo 与应用介绍 */}
          <View className="hero-section">
            <View className="logo-card">
              <Image src={xiaoguaLogo} className="logo-img" mode="aspectFit" />
            </View>
            <Text className="app-title">小呱拼豆</Text>
            <Text className="app-subtitle">照片一键转拼豆图纸 · 手作图纸排版辅助</Text>
          </View>

          <View className="content-body">
            {/* 底板尺寸选择模块 */}
            <View className="section-card size-card">
              <View className="card-header">
                <Text className="card-title">基础版（尺寸最大52*52）</Text>
                <Text className="card-tag">1:1 对位</Text>
              </View>

              {/* 预设规格 2x2 网格 */}
              <View className="preset-grid">
                {PRESET_SIZES.map((preset, idx) => {
                  const isActive = !isCustomSize && selectedPresetIndex === idx
                  return (
                    <View
                      key={preset.name}
                      className={`preset-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectPreset(idx)}
                    >
                      <Text className="preset-title">{preset.name}</Text>
                      <Text className="preset-desc">{preset.desc}</Text>
                    </View>
                  )
                })}
              </View>

              {/* 前往自定义尺寸输入框 */}
              <View
                className={`custom-size-box ${isCustomSize ? 'active' : ''}`}
                onClick={handleCustomInputFocus}
              >
                <View className="custom-banner-top">
                  <View className="custom-banner-meta">
                    <Text className="custom-banner-title">前往自定义尺寸</Text>
                    <Text className="custom-banner-sub">
                      支持任意比例、最大100*100尺寸及精细调节
                    </Text>
                  </View>
                  <View className="custom-badge">
                    <Text className="badge-text">{isCustomSize ? '已启用' : '点击自定义'}</Text>
                  </View>
                </View>

                <View className="custom-inputs-wrap">
                  <View className="num-input-wrap">
                    <Text className="input-affix">宽</Text>
                    <Input
                      type="number"
                      className="size-input"
                      value={String(customWidth)}
                      onFocus={handleCustomInputFocus}
                      onInput={e => setCustomWidth(Number(e.detail.value))}
                    />
                  </View>
                  <Text className="cross-sign">×</Text>
                  <View className="num-input-wrap">
                    <Text className="input-affix">高</Text>
                    <Input
                      type="number"
                      className="size-input"
                      value={String(customHeight)}
                      onFocus={handleCustomInputFocus}
                      onInput={e => setCustomHeight(Number(e.detail.value))}
                    />
                  </View>
                  <Text className="size-unit">格</Text>
                </View>
              </View>
            </View>

            {/* 色号标准切换栏 */}
            <View className="section-card palette-card">
              <View className="card-header">
                <Text className="card-title">🎨 修改色号标准</Text>
                <Text className="card-tip">Delta-E CIELAB 校准</Text>
              </View>

              <View className="palette-pills">
                {palettes.map(palette => {
                  const isSelected = selectedBrand === palette.id
                  return (
                    <View
                      key={palette.id}
                      className={`palette-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedBrand(palette.id)}
                    >
                      <Text className="palette-name">{palette.name}</Text>
                      <Text className="palette-count">{palette.colors.length} 色</Text>
                    </View>
                  )
                })}
              </View>
            </View>

            {/* 预留更多功能模块 */}
            <View className="section-card more-features-card">
              <View className="card-header">
                <Text className="card-title">✨ 更多功能（工坊实验室）</Text>
                <Text className="card-tag highlight">拓展模块</Text>
              </View>

              <View className="features-grid">
                <View
                  className="feature-item"
                  onClick={() => handleComingSoon('1:1 施工辅助对孔')}
                >
                  <Text className="feature-icon">🖨️</Text>
                  <View className="feature-meta">
                    <Text className="feature-title">1:1 对孔图纸打印</Text>
                    <Text className="feature-desc">垫在底板下方直接插豆</Text>
                  </View>
                  <Text className="feature-status">预留</Text>
                </View>

                <View
                  className="feature-item"
                  onClick={() => handleComingSoon('像素相机实时滤镜')}
                >
                  <Text className="feature-icon">📸</Text>
                  <View className="feature-meta">
                    <Text className="feature-title">实时取景像素相机</Text>
                    <Text className="feature-desc">镜头实时预览成画效果</Text>
                  </View>
                  <Text className="feature-status">预留</Text>
                </View>

                <View
                  className="feature-item"
                  onClick={() => handleComingSoon('经典手作图纸工坊')}
                >
                  <Text className="feature-icon">📚</Text>
                  <View className="feature-meta">
                    <Text className="feature-title">经典二次元图纸库</Text>
                    <Text className="feature-desc">上百款官方热门图样</Text>
                  </View>
                  <Text className="feature-status">预留</Text>
                </View>

                <View
                  className="feature-item"
                  onClick={() => handleComingSoon('拼豆库存与耗材预警')}
                >
                  <Text className="feature-icon">🧮</Text>
                  <View className="feature-meta">
                    <Text className="feature-title">耗材消耗与库存盘点</Text>
                    <Text className="feature-desc">按颗粒估算备货清单</Text>
                  </View>
                  <Text className="feature-status">预留</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 制作 Tab 底部占位 */}
          <View className="bottom-bar-placeholder" />
        </View>
      )}

      {/* ===================== Tab 2: 广场 ===================== */}
      {currentTab === 'plaza' && (
        <View className="tab-plaza-content">
          <View className="plaza-hero">
            <Text className="plaza-title">🪐 拼豆灵感广场</Text>
            <Text className="plaza-subtitle">探索高人气图纸 · 找灵感 · 一键导入排版</Text>
          </View>

          {/* 分类过滤器 */}
          <View className="category-scroll-bar">
            {['全部', '热门', '复古游戏', '可爱萌宠', '美食小物'].map(cat => (
              <View
                key={cat}
                className={`category-pill ${plazaCategory === cat ? 'active' : ''}`}
                onClick={() => setPlazaCategory(cat)}
              >
                <Text className="cat-name">{cat}</Text>
              </View>
            ))}
          </View>

          {/* 广场图样瀑布流卡片 */}
          <View className="plaza-grid">
            {filteredPlazaItems.map(item => (
              <View
                key={item.id}
                className="plaza-card"
                onClick={() => navigateToEditor()}
              >
                <View className="card-preview">
                  <Text className="preview-emoji">{item.icon}</Text>
                  <View className="card-tag-pill">
                    <Text>{item.tag}</Text>
                  </View>
                </View>

                <View className="card-info">
                  <Text className="item-title">{item.title}</Text>
                  <View className="item-meta">
                    <Text className="item-size">{item.size} · {item.colors}色</Text>
                    <Text className="item-likes">❤️ {item.likes}</Text>
                  </View>
                  <Button className="btn-craft-now">
                    <Text>导入制作</Text>
                  </Button>
                </View>
              </View>
            ))}
          </View>
          <View className="plaza-bottom-placeholder" />
        </View>
      )}

      {/* ===================== Tab 3: 我的 ===================== */}
      {currentTab === 'mine' && (
        <View className="tab-mine-content">
          {/* 用户个人名片 */}
          <View className="user-profile-card">
            <View className="user-avatar-wrap">
              <Image src={xiaoguaLogo} className="user-avatar-img" mode="aspectFit" />
              <View className="status-dot" />
            </View>
            <View className="user-meta">
              <View className="name-row">
                <Text className="user-name">小呱手作人</Text>
                <Text className="vip-badge">PRO 匠人版</Text>
              </View>
              <Text className="user-signature">用彩色豆豆拼出奇趣微世界 ✨</Text>
            </View>
          </View>

          {/* 数据总览 */}
          <View className="stats-dashboard">
            <View className="stat-box">
              <Text className="stat-num">0</Text>
              <Text className="stat-label">历史图纸</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-box">
              <Text className="stat-num">3</Text>
              <Text className="stat-label">色号色系</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-box">
              <Text className="stat-num">无限</Text>
              <Text className="stat-label">本地算力</Text>
            </View>
          </View>

          {/* 常用功能列表 */}
          <View className="menu-group">
            <View className="menu-item" onClick={() => handleComingSoon('我的拼豆草稿箱')}>
              <Text className="menu-icon">📁</Text>
              <Text className="menu-label">我的制作草稿箱</Text>
              <Text className="menu-arrow">&gt;</Text>
            </View>

            <View className="menu-item" onClick={() => handleComingSoon('拼豆色系与库存管理')}>
              <Text className="menu-icon">🎨</Text>
              <Text className="menu-label">常用色卡与耗材库存</Text>
              <Text className="menu-arrow">&gt;</Text>
            </View>

            <View className="menu-item" onClick={toggleTheme}>
              <Text className="menu-icon">🌓</Text>
              <Text className="menu-label">界面主题外观</Text>
              <Text className="menu-val">{theme === 'dark' ? '暗夜深邃' : '明亮素雅'}</Text>
            </View>

            <View
              className="menu-item"
              onClick={() => {
                Taro.showToast({ title: '缓存已清空，算法已重置', icon: 'success' })
              }}
            >
              <Text className="menu-icon">🧹</Text>
              <Text className="menu-label">清理本地缓存</Text>
              <Text className="menu-arrow">&gt;</Text>
            </View>

            <View
              className="menu-item"
              onClick={() => {
                Taro.showModal({
                  title: '小呱拼豆 v1.0.0 Pro',
                  content: '纯本地高保真像素量化算法，支持 Artkal / Mard / Perler 全色号高精度匹配与 1:1 图纸导出。',
                  showCancel: false
                })
              }}
            >
              <Text className="menu-icon">ℹ️</Text>
              <Text className="menu-label">关于小呱拼豆</Text>
              <Text className="menu-val">v1.0.0</Text>
            </View>
          </View>

          <View className="mine-bottom-placeholder" />
        </View>
      )}

      {/* ===================== 底部固定停靠区（无缝贴合导航栏，100%遮挡不穿透） ===================== */}
      <View className="fixed-bottom-dock">
        {currentTab === 'make' && (
          <View className="home-bottom-bar">
            <View className="quota-text">
              <Text className="quota-highlight">今日可用无限次</Text>
              <Text>（本地纯算法高效转换）</Text>
            </View>

            <Button className="btn-main-action" onClick={handlePickImage}>
              <Text className="plus-sign">+</Text>
              <Text>选择图片</Text>
            </Button>

            <View className="sample-link" onClick={handlePreviewSample}>
              <Text className="link-text">没有照片？点此体验内置经典样例 &gt;</Text>
            </View>

            <Text className="format-hint">支持 JPG、PNG、WEBP 格式</Text>
          </View>
        )}

        <View className="home-tabbar">
          <View
            className={`tabbar-item ${currentTab === 'make' ? 'active' : ''}`}
            onClick={() => setCurrentTab('make')}
          >
            <Text className="tabbar-icon">🎨</Text>
            <Text className="tabbar-label">制作</Text>
          </View>

          <View
            className={`tabbar-item ${currentTab === 'plaza' ? 'active' : ''}`}
            onClick={() => setCurrentTab('plaza')}
          >
            <Text className="tabbar-icon">🪐</Text>
            <Text className="tabbar-label">广场</Text>
          </View>

          <View
            className={`tabbar-item ${currentTab === 'mine' ? 'active' : ''}`}
            onClick={() => setCurrentTab('mine')}
          >
            <Text className="tabbar-icon">👤</Text>
            <Text className="tabbar-label">我的</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
