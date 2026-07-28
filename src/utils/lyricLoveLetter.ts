/**
 * 歌词情书生成器
 * AI 把多首歌的歌词串联成情书
 *
 * 功能特点：
 * - 从多首情歌中提取精华歌词
 * - AI智能重组为完整的情书
 * - 支持多种情书风格（深情/俏皮/诗意/幽默/古典）
 * - 可自定义收信人和签名
 * - 支持生成精美卡片导出
 */
import { getData, setData } from '@/utils/data'
import { addDevLog } from '@/utils/devKit'
import { chat } from '@/core/ai'

const LOVE_LETTER_HISTORY_KEY = 'lyric_love_letter_history'

export type LetterStyle =
  | 'deep'         // 深情
  | 'playful'      // 俏皮
  | 'poetic'       // 诗意
  | 'humorous'     // 幽默
  | 'classical'    // 古典
  | 'modern'       // 现代

export interface LetterStyleInfo {
  id: LetterStyle
  name: string
  desc: string
  /** AI prompt 模板片段 */
  promptHint: string
  /** 字数范围 */
  wordRange: [number, number]
}

export const LETTER_STYLES: LetterStyleInfo[] = [
  {
    id: 'deep',
    name: '深情款款',
    desc: '深沉含蓄，饱含爱意',
    promptHint: '用深情含蓄的笔调，每个字都要流露真挚的情感，避免直白表白',
    wordRange: [400, 600],
  },
  {
    id: 'playful',
    name: '俏皮可爱',
    desc: '活泼俏皮，带着小调皮',
    promptHint: '用俏皮可爱的语气，可以适当撒娇和开玩笑，但要真挚',
    wordRange: [300, 500],
  },
  {
    id: 'poetic',
    name: '诗意唯美',
    desc: '诗意盎然，意象丰富',
    promptHint: '用诗意的语言，多用比喻和意象，营造唯美的氛围',
    wordRange: [500, 700],
  },
  {
    id: 'humorous',
    name: '幽默风趣',
    desc: '轻松幽默，让人会心一笑',
    promptHint: '用幽默风趣的笔调，可以自嘲和反讽，但情感要真挚',
    wordRange: [300, 500],
  },
  {
    id: 'classical',
    name: '古典优雅',
    desc: '古风韵味，含蓄典雅',
    promptHint: '用古典优雅的笔调，可以融入古诗词意象，文白结合',
    wordRange: [400, 600],
  },
  {
    id: 'modern',
    name: '现代都市',
    desc: '都市感，简洁有力',
    promptHint: '用现代都市的笔调，简洁有力，体现当代人的情感',
    wordRange: [300, 450],
  },
]

export interface LoveLetterConfig {
  /** 收信人称呼 */
  recipient: string
  /** 选用的歌曲信息 */
  songs: Array<{
    id: string
    name: string
    singer: string
    lyric: string
  }>
  /** 情书风格 */
  style: LetterStyle
  /** 自定义署名（不填默认"爱你的我"） */
  signature?: string
  /** 备注特殊要求 */
  customNote?: string
}

export interface LoveLetterResult {
  id: string
  config: LoveLetterConfig
  /** 生成的情书内容 */
  content: string
  /** 引用的歌词片段 */
  quotedLyrics: Array<{ songName: string; singer: string; lyric: string }>
  /** 字数 */
  wordCount: number
  /** 生成时间 */
  createdAt: number
}

/**
 * 从歌词中提取精华句子
 * - 优先选取情歌相关的句子（包含爱、思念、心跳等关键词）
 */
export const extractRomanticLyrics = (lyrics: Array<{ songName: string; singer: string; lyric: string }>): Array<{ songName: string; singer: string; lyric: string }> => {
  const romanticKeywords = [
    '爱', '喜欢', '想念', '思念', '心跳', '心动', '深情', '温柔', '永远',
    '一生', '一世', '陪伴', '守护', '唯一', '唯一', '眼中', '心里', '梦中',
    'love', 'miss', 'heart', 'forever', 'always', 'sweet', 'darling',
  ]

  const result: Array<{ songName: string; singer: string; lyric: string }> = []

  for (const song of lyrics) {
    if (!song.lyric) continue
    const lines = song.lyric
      .split('\n')
      .map((line) => line.replace(/\[\d+:\d+\.\d+\]/g, '').trim())
      .filter((line) => line.length >= 4 && line.length <= 30)

    // 找出包含浪漫关键词的句子
    const romanticLines = lines.filter((line) =>
      romanticKeywords.some((kw) => line.toLowerCase().includes(kw.toLowerCase()))
    )

    // 如果找到浪漫句子，取前2句；否则取第一句
    const selected = romanticLines.slice(0, 2).length > 0
      ? romanticLines.slice(0, 2)
      : lines.slice(0, 1)

    for (const line of selected) {
      result.push({
        songName: song.songName,
        singer: song.singer,
        lyric: line,
      })
    }
  }

  return result.slice(0, 10)  // 最多10句
}

/**
 * 生成情书
 * - 调用AI接口生成情书
 * - 如果AI不可用，使用模板生成
 */
export const generateLoveLetter = async (config: LoveLetterConfig): Promise<LoveLetterResult> => {
  const styleInfo = LETTER_STYLES.find((s) => s.id === config.style) || LETTER_STYLES[0]
  const quotedLyrics = extractRomanticLyrics(config.songs)

  // 构建 AI prompt
  const lyricExcerpts = quotedLyrics
    .map((q, i) => `${i + 1}. 《${q.songName}》- ${q.singer}\n   "${q.lyric}"`)
    .join('\n\n')

  const prompt = `请帮我把以下歌词精华片段巧妙地串联成一封情书。

【收信人】${config.recipient}
【风格要求】${styleInfo.name} - ${styleInfo.desc}。${styleInfo.promptHint}
【字数要求】${styleInfo.wordRange[0]}-${styleInfo.wordRange[1]}字
【歌词精华】
${lyricExcerpts}

${config.customNote ? `【特殊要求】${config.customNote}` : ''}

要求：
1. 把上述歌词精华自然地融入情书，不要简单堆砌
2. 每句引用的歌词要加引号，并标注出处（如：《歌名》）
3. 情书要有完整的故事感和情感递进
4. 开头称呼：亲爱的${config.recipient}：
5. 结尾署名：${config.signature || '爱你的我'} + 日期

请直接输出情书内容，不要其他解释。`

  let content = ''
  try {
    // 调用AI接口
    const result = await chat(prompt, [], () => {}, () => {})
    content = result || ''
    addDevLog('info', 'LyricLoveLetter', `AI生成成功，字数：${content.length}`)
  } catch (err) {
    addDevLog('warn', 'LyricLoveLetter', `AI生成失败，使用模板: ${(err as Error)?.message}`)
    // AI失败时使用模板
    content = generateTemplateLetter(config, quotedLyrics, styleInfo)
  }

  const result: LoveLetterResult = {
    id: `letter_${Date.now()}`,
    config,
    content,
    quotedLyrics,
    wordCount: content.length,
    createdAt: Date.now(),
  }

  // 保存到历史
  await saveLetterHistory(result)

  return result
}

/** 模板生成（AI失败时备用） */
const generateTemplateLetter = (
  config: LoveLetterConfig,
  quotedLyrics: Array<{ songName: string; singer: string; lyric: string }>,
  styleInfo: LetterStyleInfo
): string => {
  const date = new Date().toLocaleDateString('zh-CN')
  const signature = config.signature || '爱你的我'

  let letter = `亲爱的${config.recipient}：\n\n`

  // 开场
  if (styleInfo.id === 'classical') {
    letter += `见字如面。${date}，提笔之际，千言万语涌上心头。\n\n`
  } else if (styleInfo.id === 'playful') {
    letter += `嘿，${config.recipient}！今天突然想给你写封信，你可别笑我矫情呀~\n\n`
  } else {
    letter += `夜深了，窗外的风轻轻吹过，我又想起了你。\n\n`
  }

  // 串联歌词
  letter += '每当听到这些歌，脑海中浮现的都是你的模样：\n\n'
  for (const q of quotedLyrics) {
    letter += `"${q.lyric}" ——《${q.songName}》${q.singer}\n\n`
  }

  // 结尾
  letter += `这些歌词写尽了我想对你说的话。${config.recipient}，谢谢你出现在我的生命里。\n\n`
  letter += `${signature}\n${date}`

  return letter
}

/** 获取情书历史 */
export interface LetterHistoryItem {
  id: string
  recipient: string
  style: LetterStyle
  wordCount: number
  createdAt: number
  preview: string
}

export const getLetterHistory = async (): Promise<LetterHistoryItem[]> => {
  return (await getData<LetterHistoryItem[]>(LOVE_LETTER_HISTORY_KEY)) ?? []
}

const saveLetterHistory = async (result: LoveLetterResult) => {
  const history = await getLetterHistory()
  const item: LetterHistoryItem = {
    id: result.id,
    recipient: result.config.recipient,
    style: result.config.style,
    wordCount: result.wordCount,
    createdAt: result.createdAt,
    preview: result.content.slice(0, 100),
  }
  // 最多保存30条
  const newHistory = [item, ...history].slice(0, 30)
  await setData(LOVE_LETTER_HISTORY_KEY, newHistory)
}

/** 删除单条历史 */
export const deleteLetterHistoryItem = async (id: string) => {
  const history = await getLetterHistory()
  const newHistory = history.filter((item) => item.id !== id)
  await setData(LOVE_LETTER_HISTORY_KEY, newHistory)
}

/** 清空历史 */
export const clearLetterHistory = async () => {
  await setData(LOVE_LETTER_HISTORY_KEY, [])
}

/** 导出情书为可分享文本 */
export const exportLetter = (result: LoveLetterResult): string => {
  return `${result.content}

---

🎵 引用歌曲：
${result.quotedLyrics.map((q, i) => `${i + 1}. 《${q.songName}》- ${q.singer}`).join('\n')}

✉️ Generated by Gyou LX Music · 歌词情书生成器`
}
