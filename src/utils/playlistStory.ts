/**
 * 歌单故事生成器
 * AI根据歌单歌曲名创作一个串联故事，将歌曲融入故事情节
 */
import { chat } from '@/core/ai'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

type MusicInfo = LX.Music.MusicInfo

export type StoryStyle =
  | 'romance'    // 言情
  | 'adventure'  // 冒险
  | 'mystery'    // 悬疑
  | 'scifi'      // 科幻
  | 'fantasy'    // 奇幻
  | 'nostalgia'  // 怀旧
  | 'poetry'     // 诗意
  | 'custom'     // 自定义

export type StoryLength = 'short' | 'medium' | 'long'

export interface StoryRequest {
  /** 歌曲列表 */
  songs: MusicInfo[]
  /** 故事风格 */
  style: StoryStyle
  /** 故事长度 */
  length: StoryLength
  /** 主题（可选） */
  theme?: string
  /** 是否将歌曲名加粗 */
  highlightSongs: boolean
}

export interface GeneratedStory {
  id: string
  title: string
  content: string
  style: StoryStyle
  length: StoryLength
  songsUsed: Array<{ name: string; singer: string; mentionedAt: number }>
  wordCount: number
  createdAt: number
  /** 用户评价 */
  rating?: number
}

export interface StoryStats {
  totalGenerated: number
  totalWords: number
  averageRating: number
  favoriteStyle: StoryStyle | null
  styleCounts: Record<string, number>
}

const STORIES_KEY = '@playlist_stories_v1'
const STATS_KEY = '@playlist_stories_stats_v1'
const MAX_STORIES = 30

const STYLE_NAMES: Record<StoryStyle, string> = {
  romance: '言情',
  adventure: '冒险',
  mystery: '悬疑',
  scifi: '科幻',
  fantasy: '奇幻',
  nostalgia: '怀旧',
  poetry: '诗意',
  custom: '自定义',
}

const STYLE_PROMPTS: Record<StoryStyle, string> = {
  romance: '一个浪漫的爱情故事，有甜蜜、有遗憾、有重逢',
  adventure: '一个充满冒险与挑战的旅程故事',
  mystery: '一个悬念迭起的悬疑故事',
  scifi: '一个充满未来感的科幻故事',
  fantasy: '一个奇幻魔法世界的冒险故事',
  nostalgia: '一个充满怀旧气息的回忆故事',
  poetry: '一个诗意盎然的散文式故事',
  custom: '一个自由创作的故事',
}

const LENGTH_WORDS: Record<StoryLength, number> = {
  short: 300,
  medium: 600,
  long: 1000,
}

/** 获取指定长度对应的字数 */
export const getLengthWordCount = (length: StoryLength): number => LENGTH_WORDS[length]

/** 生成故事 */
export const generateStory = async (request: StoryRequest): Promise<GeneratedStory | null> => {
  if (request.songs.length < 3) {
    addDevLog('warn', 'StoryGen', '歌曲数量不足，至少需要3首')
    return null
  }

  // 取前10首歌参与故事
  const songsToUse = request.songs.slice(0, 10)
  const songList = songsToUse.map((s, i) => `${i + 1}. 《${s.name}》- ${s.singer}`).join('\n')

  const lengthDesc = request.length === 'short' ? '简短(约300字)' : request.length === 'medium' ? '中等(约600字)' : '长篇(约1000字)'
  const themeDesc = request.theme ? `\n故事主题：${request.theme}` : ''
  const highlight = request.highlightSongs ? '\n请将引用的歌曲名用《》包裹。' : ''

  const prompt = `请创作一个${STYLE_NAMES[request.style]}风格的故事，${STYLE_PROMPTS[request.style]}。

要求：
1. 故事长度：${lengthDesc}
2. 必须巧妙融入以下歌曲名（可以原文引用，也可以作为关键意象）：
${songList}
${themeDesc}${highlight}
3. 故事要有完整的起承转合
4. 歌曲名要自然融入情节，不要生硬堆砌
5. 请先给出一个吸引人的标题

输出格式：
标题：xxx

正文：
xxx`

  try {
    const result = await chat(prompt, [])
    if (!result || !result.trim()) {
      addDevLog('error', 'StoryGen', 'AI返回空内容')
      return null
    }

    // 解析标题和正文
    const { title, content } = parseStoryResult(result)
    if (!content) {
      addDevLog('error', 'StoryGen', '解析失败')
      return null
    }

    // 找出被提及的歌曲
    const songsUsed = findMentionedSongs(content, songsToUse)

    const story: GeneratedStory = {
      id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title || '无题',
      content,
      style: request.style,
      length: request.length,
      songsUsed,
      wordCount: content.length,
      createdAt: Date.now(),
    }

    await saveStory(story)
    await updateStats(story)
    addDevLog('info', 'StoryGen', `生成故事: ${story.title}, ${story.wordCount}字, 用到${songsUsed.length}首歌`)
    return story
  } catch (e: any) {
    addDevLog('error', 'StoryGen', `生成失败: ${e?.message}`)
    return null
  }
}

/** 解析AI返回的故事 */
const parseStoryResult = (result: string): { title: string; content: string } => {
  const text = result.trim()
  let title = ''
  let content = ''

  // 尝试匹配"标题：xxx"
  const titleMatch = text.match(/^(?:标题|题目|Title)[:：]\s*(.+)/i)
  if (titleMatch) {
    title = titleMatch[1].trim()
    content = text.slice(titleMatch[0].length).trim()
  } else {
    // 第一行作为标题
    const lines = text.split(/\n+/)
    if (lines.length > 1 && lines[0].length < 50) {
      title = lines[0].replace(/^[#【《]*/, '').replace(/[】》]*$/, '').trim()
      content = lines.slice(1).join('\n').trim()
    } else {
      content = text
    }
  }

  // 去除"正文："前缀
  content = content.replace(/^正文[:：]\s*/i, '').trim()
  return { title, content }
}

/** 找出被提及的歌曲 */
const findMentionedSongs = (
  content: string,
  songs: MusicInfo[],
): Array<{ name: string; singer: string; mentionedAt: number }> => {
  const result: Array<{ name: string; singer: string; mentionedAt: number }> = []
  for (const song of songs) {
    const idx = content.indexOf(song.name)
    if (idx >= 0) {
      result.push({ name: song.name, singer: song.singer, mentionedAt: idx })
    }
  }
  return result.sort((a, b) => a.mentionedAt - b.mentionedAt)
}

/** 保存故事 */
const saveStory = async (story: GeneratedStory): Promise<void> => {
  const all = await getAllStories()
  all.unshift(story)
  await saveData(STORIES_KEY, all.slice(0, MAX_STORIES))
}

/** 获取所有故事 */
export const getAllStories = async (): Promise<GeneratedStory[]> => {
  const data = await getData<GeneratedStory[]>(STORIES_KEY)
  return data || []
}

/** 删除故事 */
export const deleteStory = async (id: string): Promise<void> => {
  const all = await getAllStories()
  await saveData(STORIES_KEY, all.filter((s) => s.id !== id))
}

/** 评价故事 */
export const rateStory = async (id: string, rating: number): Promise<void> => {
  if (rating < 1 || rating > 5) return
  const all = await getAllStories()
  const story = all.find((s) => s.id === id)
  if (story) {
    story.rating = rating
    await saveData(STORIES_KEY, all)
    addDevLog('info', 'StoryGen', `评价故事 ${id}: ${rating}星`)
  }
}

/** 更新统计 */
const updateStats = async (story: GeneratedStory): Promise<void> => {
  const stats = await getStats()
  stats.totalGenerated++
  stats.totalWords += story.wordCount

  const styleKey = String(story.style)
  stats.styleCounts[styleKey] = (stats.styleCounts[styleKey] || 0) + 1

  // 找出最喜欢的风格
  let maxCount = 0
  let favStyle: StoryStyle | null = null
  for (const [style, count] of Object.entries(stats.styleCounts)) {
    if (count > maxCount) {
      maxCount = count
      favStyle = style as StoryStyle
    }
  }
  stats.favoriteStyle = favStyle

  // 平均评分
  const all = await getAllStories()
  const rated = all.filter((s) => s.rating !== undefined)
  if (rated.length > 0) {
    stats.averageRating = Math.round((rated.reduce((s, r) => s + (r.rating || 0), 0) / rated.length) * 10) / 10
  }

  await saveData(STATS_KEY, stats)
}

/** 获取统计 */
export const getStats = async (): Promise<StoryStats> => {
  const data = await getData<StoryStats>(STATS_KEY)
  return data || {
    totalGenerated: 0,
    totalWords: 0,
    averageRating: 0,
    favoriteStyle: null,
    styleCounts: {},
  }
}

/** 获取风格名 */
export const getStyleName = (style: StoryStyle): string => STYLE_NAMES[style]

/** 获取风格描述 */
export const getStyleDescription = (style: StoryStyle): string => STYLE_PROMPTS[style]

/** 获取所有风格 */
export const getAllStyles = (): Array<{ key: StoryStyle; name: string; desc: string }> =>
  Object.entries(STYLE_NAMES).map(([key, name]) => ({
    key: key as StoryStyle,
    name,
    desc: STYLE_PROMPTS[key as StoryStyle],
  }))

/** 获取所有长度选项 */
export const getAllLengths = (): Array<{ key: StoryLength; name: string; desc: string }> => [
  { key: 'short', name: '短篇', desc: '约300字，简洁精炼' },
  { key: 'medium', name: '中篇', desc: '约600字，情节丰富' },
  { key: 'long', name: '长篇', desc: '约1000字，沉浸体验' },
]

/** 重新生成故事（用同样的请求） */
export const regenerateStory = async (request: StoryRequest): Promise<GeneratedStory | null> => {
  return generateStory(request)
}

/** 生成故事摘要（前100字） */
export const getStorySummary = (story: GeneratedStory): string => {
  const text = story.content.replace(/\n+/g, ' ').trim()
  return text.length > 100 ? text.slice(0, 100) + '...' : text
}

/** 清空所有故事 */
export const clearAllStories = async (): Promise<void> => {
  await saveData(STORIES_KEY, [])
  await saveData(STATS_KEY, null)
  addDevLog('info', 'StoryGen', '所有故事已清空')
}
