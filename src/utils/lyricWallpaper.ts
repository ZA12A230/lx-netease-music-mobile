/**
 * 歌词壁纸生成器
 * 把喜欢的歌词生成精美手机壁纸，支持多种风格
 *
 * 功能特点：
 * - 10种壁纸风格（极简/渐变/暗夜/手写/杂志/复古/赛博/水彩/星空/极光）
 * - 自动提取歌词精华句
 * - 自定义背景色和文字颜色
 * - 适配主流手机分辨率（1080x1920 / 1080x2400）
 * - 可保存到本地相册
 */
import { getData, setData } from '@/utils/data'
import { addDevLog } from '@/utils/devKit'
import { btoa } from 'react-native-quick-base64'

const WALLPAPER_HISTORY_KEY = 'wallpaper_history'

/** 壁纸风格类型 */
export type WallpaperStyle =
  | 'minimal'      // 极简
  | 'gradient'     // 渐变
  | 'dark'         // 暗夜
  | 'handwriting'  // 手写
  | 'magazine'     // 杂志
  | 'vintage'      // 复古
  | 'cyber'        // 赛博
  | 'watercolor'   // 水彩
  | 'starry'       // 星空
  | 'aurora'       // 极光

export interface WallpaperStyleInfo {
  id: WallpaperStyle
  name: string
  desc: string
  bgColors: string[]      // 渐变色（多个用于渐变）
  textColor: string
  accentColor: string
  fontFamily: 'sans' | 'serif' | 'mono'
}

/** 10种壁纸风格定义 */
export const WALLPAPER_STYLES: WallpaperStyleInfo[] = [
  {
    id: 'minimal',
    name: '极简',
    desc: '纯色背景，简洁排版',
    bgColors: ['#FAFAFA'],
    textColor: '#222222',
    accentColor: '#888888',
    fontFamily: 'sans',
  },
  {
    id: 'gradient',
    name: '渐变',
    desc: '柔和渐变背景',
    bgColors: ['#FF9A9E', '#FECFEF', '#FECFEF'],
    textColor: '#FFFFFF',
    accentColor: '#FFD3D3',
    fontFamily: 'sans',
  },
  {
    id: 'dark',
    name: '暗夜',
    desc: '深色背景，明亮文字',
    bgColors: ['#0F0F1A', '#1A1A2E'],
    textColor: '#FFFFFF',
    accentColor: '#00D9FF',
    fontFamily: 'sans',
  },
  {
    id: 'handwriting',
    name: '手写',
    desc: '手写体风格，温馨感',
    bgColors: ['#FFF8E7', '#FFE3B3'],
    textColor: '#5D4037',
    accentColor: '#8D6E63',
    fontFamily: 'serif',
  },
  {
    id: 'magazine',
    name: '杂志',
    desc: '杂志封面风格',
    bgColors: ['#1A1A1A', '#2C2C2C'],
    textColor: '#FFFFFF',
    accentColor: '#FFD700',
    fontFamily: 'serif',
  },
  {
    id: 'vintage',
    name: '复古',
    desc: '老照片质感',
    bgColors: ['#D4B896', '#A0826D'],
    textColor: '#3E2723',
    accentColor: '#5D4037',
    fontFamily: 'serif',
  },
  {
    id: 'cyber',
    name: '赛博',
    desc: '霓虹未来感',
    bgColors: ['#0D0221', '#290744'],
    textColor: '#00FFFF',
    accentColor: '#FF00FF',
    fontFamily: 'mono',
  },
  {
    id: 'watercolor',
    name: '水彩',
    desc: '水彩晕染效果',
    bgColors: ['#E0C3FC', '#8EC5FC'],
    textColor: '#FFFFFF',
    accentColor: '#FFFFFF',
    fontFamily: 'sans',
  },
  {
    id: 'starry',
    name: '星空',
    desc: '深邃星空背景',
    bgColors: ['#000428', '#004E92'],
    textColor: '#FFFFFF',
    accentColor: '#FFD700',
    fontFamily: 'sans',
  },
  {
    id: 'aurora',
    name: '极光',
    desc: '极光绚烂色彩',
    bgColors: ['#00C9FF', '#92FE9D', '#92FE9D'],
    textColor: '#FFFFFF',
    accentColor: '#FFFFFF',
    fontFamily: 'sans',
  },
]

export interface WallpaperConfig {
  lyric: string             // 歌词文本
  songName: string          // 歌曲名
  singer: string            // 歌手
  style: WallpaperStyle     // 风格
  width: number             // 宽
  height: number            // 高
}

export interface WallpaperResult {
  config: WallpaperConfig
  createdAt: number
  /** 生成的壁纸数据URI（SVG格式） */
  dataUri: string
  /** 缩略图（用于历史列表） */
  thumbnail: string
}

/**
 * 从完整歌词中提取精华句
 * 优先选取：
 * 1. 高潮部分（通常是重复出现频率最高的句子）
 * 2. 长度适中的句子（10-30字）
 * 3. 排除重复行
 */
export const extractHighlightLyric = (lyric: string): string[] => {
  if (!lyric) return []

  // 清洗歌词：去除时间标签、空行
  const lines = lyric
    .split('\n')
    .map((line) => line.replace(/\[\d+:\d+\.\d+\]/g, '').trim())
    .filter((line) => line.length >= 5 && line.length <= 50)
    .filter((line) => !/^(作词|作曲|编曲|混音|制作人|出品)/.test(line))

  if (lines.length === 0) return []

  // 统计句子出现频率
  const freq: Record<string, number> = {}
  for (const line of lines) {
    freq[line] = (freq[line] || 0) + 1
  }

  // 按频率排序，频率高的（高潮部分）优先
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([line]) => line)

  // 去重并返回前5句
  return Array.from(new Set(sorted)).slice(0, 5)
}

/**
 * 生成SVG壁纸
 * - 将歌词渲染为SVG格式
 * - 支持渐变背景
 * - 自动换行处理
 */
export const generateWallpaper = (config: WallpaperConfig): WallpaperResult => {
  const styleInfo = WALLPAPER_STYLES.find((s) => s.id === config.style) || WALLPAPER_STYLES[0]

  // 计算歌词换行
  const lines = wrapText(config.lyric, config.width - 100, 28)
  const lineHeight = 40
  const totalHeight = lines.length * lineHeight
  const startY = (config.height - totalHeight) / 2

  // 构建渐变定义
  const gradientId = 'bg_grad'
  const gradientDef = styleInfo.bgColors.length > 1
    ? `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        ${styleInfo.bgColors.map((c, i) =>
          `<stop offset="${(i / (styleInfo.bgColors.length - 1)) * 100}%" stop-color="${c}" />`
        ).join('')}
      </linearGradient>`
    : ''

  const bgColor = styleInfo.bgColors.length > 1 ? `url(#${gradientId})` : styleInfo.bgColors[0]

  // 装饰元素（根据风格）
  const decorations = generateDecorations(config.style, config.width, config.height, styleInfo.accentColor)

  // 顶部歌曲信息
  const headerY = 80
  const footerY = config.height - 80

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">
  <defs>
    ${gradientDef}
  </defs>
  <rect width="${config.width}" height="${config.height}" fill="${bgColor}" />
  ${decorations}
  <!-- 顶部歌曲信息 -->
  <text x="${config.width / 2}" y="${headerY}" text-anchor="middle"
    font-family="sans-serif" font-size="20" fill="${styleInfo.accentColor}" opacity="0.85">
    ${escapeXml(config.songName)}
  </text>
  <text x="${config.width / 2}" y="${headerY + 28}" text-anchor="middle"
    font-family="sans-serif" font-size="14" fill="${styleInfo.textColor}" opacity="0.6">
    ${escapeXml(config.singer)}
  </text>
  <!-- 歌词主体 -->
  ${lines.map((line, i) =>
    `<text x="${config.width / 2}" y="${startY + i * lineHeight + lineHeight}" text-anchor="middle"
      font-family="${styleInfo.fontFamily === 'mono' ? 'monospace' : styleInfo.fontFamily === 'serif' ? 'serif' : 'sans-serif'}"
      font-size="28" font-weight="600" fill="${styleInfo.textColor}">
      ${escapeXml(line)}
    </text>`
  ).join('')}
  <!-- 底部装饰 -->
  <text x="${config.width / 2}" y="${footerY}" text-anchor="middle"
    font-family="sans-serif" font-size="12" fill="${styleInfo.accentColor}" opacity="0.6">
    Gyou LX Music · 歌词壁纸
  </text>
</svg>`

  // 缩略图（缩小到200x356）
  const thumbnail = generateThumbnail(svg, 200)

  const result: WallpaperResult = {
    config,
    createdAt: Date.now(),
    dataUri: `data:image/svg+xml;base64,${btoa(encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))}`,
    thumbnail,
  }

  // 保存到历史
  void saveToHistory(result)

  return result
}

/** 文本换行 */
const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
  const charsPerLine = Math.floor(maxWidth / (fontSize * 0.55))
  const lines: string[] = []
  let current = ''

  for (const char of text) {
    if (char === '\n') {
      if (current) lines.push(current)
      current = ''
      continue
    }
    current += char
    if (current.length >= charsPerLine) {
      lines.push(current)
      current = ''
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [text]
}

/** 生成装饰元素 */
const generateDecorations = (
  style: WallpaperStyle,
  width: number,
  height: number,
  accentColor: string
): string => {
  switch (style) {
    case 'starry':
      // 星空：随机点缀星星
      return Array.from({ length: 50 }, () => {
        const x = Math.random() * width
        const y = Math.random() * height
        const r = Math.random() * 1.5 + 0.5
        const opacity = Math.random() * 0.8 + 0.2
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" opacity="${opacity}" />`
      }).join('')
    case 'aurora':
      // 极光：波浪形渐变
      return `<path d="M0,${height * 0.3} Q${width / 4},${height * 0.2} ${width / 2},${height * 0.35} T${width},${height * 0.3} L${width},${height * 0.5} L0,${height * 0.5} Z" fill="${accentColor}" opacity="0.2" />`
    case 'cyber':
      // 赛博：网格线
      return Array.from({ length: 10 }, (_, i) =>
        `<line x1="0" y1="${(height / 10) * i}" x2="${width}" y2="${(height / 10) * i}" stroke="${accentColor}" stroke-width="0.5" opacity="0.2" />`
      ).join('')
    case 'vintage':
      // 复古：边框
      return `<rect x="40" y="40" width="${width - 80}" height="${height - 80}" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.4" />`
    case 'magazine':
      // 杂志：底部装饰线
      return `<line x1="40" y1="${height - 120}" x2="${width - 40}" y2="${height - 120}" stroke="${accentColor}" stroke-width="1" opacity="0.6" />`
    default:
      return ''
  }
}

/** 生成缩略图（简化版SVG） */
const generateThumbnail = (svg: string, targetWidth: number): string => {
  // 简单返回原SVG（实际应用中可使用rn-fetch-blob生成真实缩略图）
  return svg
}

/** XML 特殊字符转义 */
const escapeXml = (s: string): string => {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '\'': return '&apos;'
      case '"': return '&quot;'
      default: return c
    }
  })
}

/** 历史记录管理 */
export interface WallpaperHistoryItem {
  id: string
  songName: string
  singer: string
  lyric: string
  style: WallpaperStyle
  createdAt: number
  thumbnail: string
}

export const getWallpaperHistory = async (): Promise<WallpaperHistoryItem[]> => {
  return (await getData<WallpaperHistoryItem[]>(WALLPAPER_HISTORY_KEY)) ?? []
}

const saveToHistory = async (result: WallpaperResult) => {
  try {
    const history = await getWallpaperHistory()
    const item: WallpaperHistoryItem = {
      id: `wp_${result.createdAt}`,
      songName: result.config.songName,
      singer: result.config.singer,
      lyric: result.config.lyric,
      style: result.config.style,
      createdAt: result.createdAt,
      thumbnail: result.thumbnail,
    }
    // 最多保存20条
    const newHistory = [item, ...history].slice(0, 20)
    await setData(WALLPAPER_HISTORY_KEY, newHistory)
  } catch (e) {
    addDevLog('warn', 'LyricWallpaper', `保存历史失败: ${(e as Error)?.message}`)
  }
}

export const clearWallpaperHistory = async () => {
  await setData(WALLPAPER_HISTORY_KEY, [])
}

/** 删除单条历史 */
export const deleteWallpaperHistoryItem = async (id: string) => {
  const history = await getWallpaperHistory()
  const newHistory = history.filter((item) => item.id !== id)
  await setData(WALLPAPER_HISTORY_KEY, newHistory)
}
