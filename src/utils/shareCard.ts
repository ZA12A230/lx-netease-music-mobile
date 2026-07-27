/**
 * 音乐分享卡片模块
 * 生成精美的音乐分享卡片，可保存到相册或分享
 */
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export type CardTemplate =
  | 'classic'      // 经典风格
  | 'vinyl'        // 黑胶唱片
  | 'lyric'        // 歌词卡片
  | 'minimal'      // 极简风
  | 'gradient'     // 渐变背景
  | 'polaroid'     // 拍立得
  | 'magazine'     // 杂志风
  | 'neon'         // 霓虹风
  | 'retro'        // 复古风
  | 'dark'         // 暗黑风

export interface CardConfig {
  template: CardTemplate
  /** 主色调 */
  primaryColor: string
  /** 副色调 */
  secondaryColor: string
  /** 背景色 */
  backgroundColor: string
  /** 文字颜色 */
  textColor: string
  /** 是否显示封面 */
  showCover: boolean
  /** 是否显示歌词 */
  showLyric: boolean
  /** 歌词内容 */
  lyric?: string
  /** 是否显示统计信息 */
  showStats: boolean
  /** 播放次数 */
  playCount?: number
  /** 是否显示二维码 */
  showQRCode: boolean
  /** 自定义文字 */
  customText?: string
  /** 字体大小 */
  fontSize: number
}

export interface ShareCardData {
  musicInfo: MusicInfo
  config: CardConfig
  /** 生成时间 */
  createdAt: number
}

/** 默认配置 */
const DEFAULT_CONFIG: CardConfig = {
  template: 'classic',
  primaryColor: '#07C556',
  secondaryColor: '#FFFFFF',
  backgroundColor: '#000000',
  textColor: '#FFFFFF',
  showCover: true,
  showLyric: false,
  showStats: false,
  showQRCode: false,
  fontSize: 16,
}

/** 模板预设 */
export const TEMPLATE_PRESETS: Record<CardTemplate, Partial<CardConfig> & { name: string; icon: string }> = {
  classic: {
    name: '经典',
    icon: '🎨',
    template: 'classic',
    primaryColor: '#07C556',
    secondaryColor: '#FFFFFF',
    backgroundColor: '#1A1A1A',
    textColor: '#FFFFFF',
  },
  vinyl: {
    name: '黑胶',
    icon: '💿',
    template: 'vinyl',
    primaryColor: '#FF6B35',
    secondaryColor: '#000000',
    backgroundColor: '#1A1A1A',
    textColor: '#FF6B35',
  },
  lyric: {
    name: '歌词',
    icon: '📝',
    template: 'lyric',
    primaryColor: '#FFFFFF',
    secondaryColor: '#000000',
    backgroundColor: '#2C3E50',
    textColor: '#ECF0F1',
  },
  minimal: {
    name: '极简',
    icon: '⚪',
    template: 'minimal',
    primaryColor: '#000000',
    secondaryColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
  },
  gradient: {
    name: '渐变',
    icon: '🌈',
    template: 'gradient',
    primaryColor: '#667EEA',
    secondaryColor: '#764BA2',
    backgroundColor: '#667EEA',
    textColor: '#FFFFFF',
  },
  polaroid: {
    name: '拍立得',
    icon: '📷',
    template: 'polaroid',
    primaryColor: '#000000',
    secondaryColor: '#FFFFFF',
    backgroundColor: '#F5F5DC',
    textColor: '#000000',
  },
  magazine: {
    name: '杂志',
    icon: '📰',
    template: 'magazine',
    primaryColor: '#E74C3C',
    secondaryColor: '#000000',
    backgroundColor: '#FFFFFF',
    textColor: '#000000',
  },
  neon: {
    name: '霓虹',
    icon: '💡',
    template: 'neon',
    primaryColor: '#FF00FF',
    secondaryColor: '#00FFFF',
    backgroundColor: '#0D0221',
    textColor: '#FF00FF',
  },
  retro: {
    name: '复古',
    icon: '📻',
    template: 'retro',
    primaryColor: '#D4AF37',
    secondaryColor: '#8B4513',
    backgroundColor: '#F5E6D3',
    textColor: '#3E2723',
  },
  dark: {
    name: '暗黑',
    icon: '🌑',
    template: 'dark',
    primaryColor: '#FFFFFF',
    secondaryColor: '#FF0000',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
  },
}

/** 生成卡片配置 */
export const createCardConfig = (overrides?: Partial<CardConfig>): CardConfig => ({
  ...DEFAULT_CONFIG,
  ...(overrides || {}),
})

/** 应用模板 */
export const applyTemplate = (template: CardTemplate, base?: CardConfig): CardConfig => {
  const preset = TEMPLATE_PRESETS[template]
  return {
    ...(base || DEFAULT_CONFIG),
    template,
    primaryColor: preset.primaryColor || DEFAULT_CONFIG.primaryColor,
    secondaryColor: preset.secondaryColor || DEFAULT_CONFIG.secondaryColor,
    backgroundColor: preset.backgroundColor || DEFAULT_CONFIG.backgroundColor,
    textColor: preset.textColor || DEFAULT_CONFIG.textColor,
  }
}

/** 生成分享数据 */
export const createShareData = (
  musicInfo: MusicInfo,
  config: CardConfig,
  lyric?: string,
  playCount?: number,
): ShareCardData => {
  return {
    musicInfo,
    config: {
      ...config,
      lyric,
      playCount,
    },
    createdAt: Date.now(),
  }
}

/** 渲染卡片为图片（伪实现，需要原生模块） */
export const renderCardToImage = async (data: ShareCardData): Promise<string | null> => {
  try {
    // 实际需要原生模块支持，如 react-native-view-shot
    addDevLog('info', 'ShareCard', `渲染卡片: ${data.musicInfo.name} (${data.config.template})`)
    return null
  } catch (e: any) {
    addDevLog('error', 'ShareCard', `渲染失败: ${e?.message}`)
    return null
  }
}

/** 分享卡片 */
export const shareCard = async (data: ShareCardData): Promise<boolean> => {
  try {
    const imagePath = await renderCardToImage(data)
    if (!imagePath) {
      addDevLog('warn', 'ShareCard', '图片渲染失败，使用文本分享')
      // 退化为文本分享
      return shareAsText(data)
    }

    // 实际分享需要 react-native-share 或系统分享
    addDevLog('info', 'ShareCard', `分享卡片: ${data.musicInfo.name}`)
    return true
  } catch (e: any) {
    addDevLog('error', 'ShareCard', `分享失败: ${e?.message}`)
    return false
  }
}

/** 退化为文本分享 */
const shareAsText = (data: ShareCardData): boolean => {
  const { musicInfo, config } = data
  const text = `🎵 ${musicInfo.name} - ${musicInfo.singer}\n\n${config.lyric ? `💬 ${config.lyric}\n\n` : ''}来自我的音乐播放器`
  // 实际需要调用系统分享
  addDevLog('info', 'ShareCard', `文本分享: ${text.slice(0, 50)}...`)
  return true
}

/** 保存卡片到相册 */
export const saveCardToAlbum = async (data: ShareCardData): Promise<boolean> => {
  try {
    const imagePath = await renderCardToImage(data)
    if (!imagePath) {
      addDevLog('warn', 'ShareCard', '图片渲染失败，无法保存')
      return false
    }
    // 实际需要调用原生模块保存到相册
    addDevLog('info', 'ShareCard', '卡片已保存到相册')
    return true
  } catch (e: any) {
    addDevLog('error', 'ShareCard', `保存失败: ${e?.message}`)
    return false
  }
}

/** 获取模板描述 */
export const getTemplateDescription = (template: CardTemplate): string => {
  const descriptions: Record<CardTemplate, string> = {
    classic: '经典深色背景，简洁大方',
    vinyl: '黑胶唱片造型，复古韵味',
    lyric: '突出歌词展示，文艺范十足',
    minimal: '极简白色背景，干净利落',
    gradient: '渐变色彩背景，时尚现代',
    polaroid: '拍立得相框，温馨怀旧',
    magazine: '杂志排版风格，专业感强',
    neon: '霓虹灯效果，赛博朋克风',
    retro: '复古色调，老式收音机风',
    dark: '纯黑背景，极致简约',
  }
  return descriptions[template]
}

/** 推荐模板（基于歌曲特征） */
export const recommendTemplate = (musicInfo: MusicInfo): CardTemplate => {
  const text = (musicInfo.name + ' ' + musicInfo.singer).toLowerCase()
  if (/夜|moon|night|夜晚|月/.test(text)) return 'dark'
  if (/怀旧|retro|经典|老歌|岁月/.test(text)) return 'retro'
  if (/爱|love|心|heart|浪漫/.test(text)) return 'gradient'
  if (/摇滚|rock|金属|metal|punk/.test(text)) return 'neon'
  if (/纯音乐|钢琴|piano|古典|classical/.test(text)) return 'minimal'
  if (/民谣|folk|故事|记忆/.test(text)) return 'polaroid'
  if (/流行|pop|舞曲|dance/.test(text)) return 'magazine'
  return 'classic'
}

/** 获取所有模板列表 */
export const getAllTemplates = (): Array<{
  template: CardTemplate
  name: string
  icon: string
  description: string
}> => {
  return (Object.keys(TEMPLATE_PRESETS) as CardTemplate[]).map((template) => ({
    template,
    name: TEMPLATE_PRESETS[template].name,
    icon: TEMPLATE_PRESETS[template].icon,
    description: getTemplateDescription(template),
  }))
}
