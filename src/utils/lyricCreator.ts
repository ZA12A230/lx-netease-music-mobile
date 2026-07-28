/**
 * 歌词创作助手
 * AI辅助歌词创作，提供押韵、灵感、续写等功能
 */
import { chat } from '@/core/ai'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

export type LyricStyle =
  | 'pop' | 'rock' | 'folk' | 'rap' | 'classical' | 'electronic' | 'rnb' | 'custom'

export type LyricMood =
  | 'happy' | 'sad' | 'love' | 'angry' | 'peaceful' | 'nostalgic' | 'passionate' | 'lonely'

export interface CreationProject {
  id: string
  title: string
  theme: string
  style: LyricStyle
  mood: LyricMood
  content: string
  createdAt: number
  updatedAt: number
}

export interface RhymeResult {
  word: string
  rhymes: string[]
  pinyin: string
}

export interface InspirationPrompt {
  type: 'title' | 'theme' | 'imagery' | 'metaphor' | 'story'
  content: string
}

const PROJECTS_KEY = '@lyric_projects_v1'

const STYLE_NAMES: Record<LyricStyle, string> = {
  pop: '流行',
  rock: '摇滚',
  folk: '民谣',
  rap: '说唱',
  classical: '古风',
  electronic: '电子',
  rnb: 'R&B',
  custom: '自定义',
}

const MOOD_NAMES: Record<LyricMood, string> = {
  happy: '欢快',
  sad: '悲伤',
  love: '爱情',
  angry: '愤怒',
  peaceful: '宁静',
  nostalgic: '怀旧',
  passionate: '激情',
  lonely: '孤独',
}

/** 查找押韵字 */
export const findRhymes = (word: string): RhymeResult => {
  const pinyin = simplePinyin(word)
  const final = extractFinal(pinyin)
  const rhymes: string[] = []

  // 简化的韵脚匹配
  const rhymeMap: Record<string, string[]> = {
    'a': ['花', '家', '夏', '霞', '茶', '沙', '涯', '啦', '吗', '妈'],
    'o': ['多', '歌', '河', '坡', '波', '窝', '锅', '啰', '错', '说'],
    'e': ['哥', '喝', '车', '热', '舍', '客', '乐', '色', '惹', '刻'],
    'i': ['你', '里', '起', '意', '西', '时', '思', '知', '日', '事'],
    'u': ['不', '出', '书', '树', '路', '度', '住', '主', '入', '故'],
    'v': ['去', '绿', '雨', '语', '遇', '曲', '局', '需', '虚', '余'],
    'an': ['看', '山', '天', '年', '前', '远', '间', '现', '变', '脸'],
    'en': ['人', '神', '春', '真', '深', '门', '们', '分', '本', '根'],
    'in': ['心', '音', '今', '金', '林', '亲', '近', '进', '信', '新'],
    'ang': ['光', '想', '上', '方', '长', '场', '唱', '浪', '苍', '茫'],
    'eng': ['风', '空', '中', '红', '同', '梦', '动', '痛', '送', '种'],
    'ing': ['情', '星', '明', '听', '行', '青', '轻', '静', '影', '景'],
    'ong': ['中', '红', '同', '梦', '动', '痛', '送', '种', '东', '空'],
  }

  if (final && rhymeMap[final]) {
    rhymes.push(...rhymeMap[final].filter((w) => w !== word))
  }

  return { word, rhymes, pinyin }
}

/** 简化的拼音转换 */
const simplePinyin = (char: string): string => {
  // 简化版：仅返回字符作为占位
  // 实际项目应引入完整的拼音库
  return char
}

/** 提取韵脚 */
const extractFinal = (pinyin: string): string => {
  const finals = ['ang', 'eng', 'ing', 'ong', 'an', 'en', 'in', 'a', 'o', 'e', 'i', 'u', 'v']
  for (const f of finals) {
    if (pinyin.endsWith(f)) return f
  }
  return ''
}

/** AI生成歌词 */
export const generateLyric = async (
  theme: string,
  style: LyricStyle,
  mood: LyricMood,
  keywords?: string[],
): Promise<string | null> => {
  try {
    const prompt = `请创作一首${STYLE_NAMES[style]}风格的歌词，主题是"${theme}"，情感基调为${MOOD_NAMES[mood]}。
${keywords?.length ? `包含以下关键词: ${keywords.join(', ')}` : ''}

要求:
1. 包含主歌和副歌
2. 押韵工整
3. 意境优美
4. 字数适中（200-400字）

请直接输出歌词内容，不要其他说明。`

    const result = await chat(prompt)
    addDevLog('info', 'LyricCreator', `AI生成歌词: 主题=${theme}, 风格=${style}`)
    return result?.trim() || null
  } catch (e: any) {
    addDevLog('error', 'LyricCreator', `生成失败: ${e?.message}`)
    return null
  }
}

/** AI续写歌词 */
export const continueLyric = async (existingLyric: string, style: LyricStyle): Promise<string | null> => {
  try {
    const prompt = `请续写以下歌词，保持风格和押韵一致（${STYLE_NAMES[style]}风格）:

${existingLyric}

请直接输出续写内容，约4-8行。`

    const result = await chat(prompt)
    return result?.trim() || null
  } catch (e: any) {
    addDevLog('error', 'LyricCreator', `续写失败: ${e?.message}`)
    return null
  }
}

/** AI改写歌词 */
export const rewriteLyric = async (
  lyric: string,
  targetStyle: LyricStyle,
): Promise<string | null> => {
  try {
    const prompt = `请将以下歌词改写为${STYLE_NAMES[targetStyle]}风格，保持原意:

${lyric}

请直接输出改写后的歌词。`

    const result = await chat(prompt)
    return result?.trim() || null
  } catch (e: any) {
    addDevLog('error', 'LyricCreator', `改写失败: ${e?.message}`)
    return null
  }
}

/** 生成灵感提示 */
export const generateInspiration = async (theme: string): Promise<InspirationPrompt[]> => {
  const inspirations: InspirationPrompt[] = []

  // 基于主题生成多个维度的灵感
  inspirations.push({
    type: 'title',
    content: `关于"${theme}"的标题灵感：《${theme}之歌》《${theme}絮语》《${theme}日记》`,
  })

  inspirations.push({
    type: 'imagery',
    content: `"${theme}"相关意象: 阳光、雨滴、微风、回忆、远方、星空、海洋、落叶`,
  })

  inspirations.push({
    type: 'metaphor',
    content: `"${theme}"的隐喻: 像清晨第一缕阳光、像深夜未眠的灯火、像初春融化的雪`,
  })

  try {
    const prompt = `为主题"${theme}"生成3个歌词创作灵感，每个灵感包含意象或隐喻。直接输出，每行一个。`
    const result = await chat(prompt)
    if (result) {
      const lines = result.split('\n').filter((l) => l.trim()).slice(0, 3)
      for (const line of lines) {
        inspirations.push({ type: 'story', content: line.trim() })
      }
    }
  } catch {
    // 静默处理
  }

  addDevLog('info', 'LyricCreator', `生成${inspirations.length}个灵感`)
  return inspirations
}

/** 保存创作项目 */
export const saveProject = async (project: CreationProject): Promise<void> => {
  const all = await getAllProjects()
  const idx = all.findIndex((p) => p.id === project.id)
  project.updatedAt = Date.now()
  if (idx >= 0) {
    all[idx] = project
  } else {
    all.unshift(project)
  }
  await saveData(PROJECTS_KEY, all.slice(0, 100))
  addDevLog('info', 'LyricCreator', `保存项目: ${project.title}`)
}

/** 获取所有项目 */
export const getAllProjects = async (): Promise<CreationProject[]> => {
  const data = await getData<CreationProject[]>(PROJECTS_KEY)
  return data || []
}

/** 删除项目 */
export const deleteProject = async (id: string): Promise<void> => {
  const all = await getAllProjects()
  const filtered = all.filter((p) => p.id !== id)
  await saveData(PROJECTS_KEY, filtered)
}

/** 创建新项目 */
export const createProject = (
  title: string,
  theme: string,
  style: LyricStyle = 'pop',
  mood: LyricMood = 'love',
): CreationProject => ({
  id: `lyric_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  title,
  theme,
  style,
  mood,
  content: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

/** 获取风格名称 */
export const getStyleName = (style: LyricStyle): string => STYLE_NAMES[style]

/** 获取情绪名称 */
export const getMoodName = (mood: LyricMood): string => MOOD_NAMES[mood]

/** 获取所有风格 */
export const getAllStyles = (): Array<{ key: LyricStyle; name: string }> =>
  Object.entries(STYLE_NAMES).map(([key, name]) => ({ key: key as LyricStyle, name }))

/** 获取所有情绪 */
export const getAllMoods = (): Array<{ key: LyricMood; name: string }> =>
  Object.entries(MOOD_NAMES).map(([key, name]) => ({ key: key as LyricMood, name }))
