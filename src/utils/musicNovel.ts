/**
 * 音乐小说
 * AI根据歌单生成连载小说，每章融入一首歌，形成完整故事线
 */
import { chat } from '@/core/ai'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

type MusicInfo = LX.Music.MusicInfo

export type NovelGenre =
  | 'urban_romance' | 'fantasy_epic' | 'scifi_adventure' | 'mystery_thriller'
  | 'youth_campus' | 'historical_drama' | 'slice_of_life' | 'wuxia'

export interface NovelChapter {
  index: number
  title: string
  content: string
  song: MusicInfo
  summary: string
  createdAt: number
  wordCount: number
}

export interface MusicNovel {
  id: string
  title: string
  genre: NovelGenre
  description: string
  chapters: NovelChapter[]
  totalWords: number
  createdAt: number
  updatedAt: number
  coverPrompt?: string
}

const NOVELS_KEY = '@music_novels_v1'
const MAX_NOVELS = 20
const MAX_CHAPTERS = 30

const GENRE_NAMES: Record<NovelGenre, string> = {
  urban_romance: '都市言情',
  fantasy_epic: '奇幻史诗',
  scifi_adventure: '科幻冒险',
  mystery_thriller: '悬疑惊悚',
  youth_campus: '青春校园',
  historical_drama: '历史传奇',
  slice_of_life: '温馨日常',
  wuxia: '武侠江湖',
}

const GENRE_PROMPTS: Record<NovelGenre, string> = {
  urban_romance: '现代都市爱情故事，细腻的情感描写，有甜蜜有虐心',
  fantasy_epic: '宏大的奇幻世界，魔法与冒险，史诗般的叙事',
  scifi_adventure: '未来科幻设定，科技与人性，探索未知',
  mystery_thriller: '悬疑推理，层层递进的谜题，出人意料的转折',
  youth_campus: '青春校园故事，友情与成长，纯真的情感',
  historical_drama: '历史背景下的传奇故事，权谋与情感交织',
  slice_of_life: '温馨的日常生活，治愈系故事，平凡中的美好',
  wuxia: '武侠江湖，快意恩仇，侠骨柔情',
}

/** 创建音乐小说 */
export const createNovel = async (
  songs: MusicInfo[],
  genre: NovelGenre,
  title?: string,
): Promise<MusicNovel | null> => {
  if (songs.length < 3) {
    addDevLog('warn', 'MusicNovel', '歌曲数量不足，至少需要3首')
    return null
  }

  const songsToUse = songs.slice(0, MAX_CHAPTERS)
  const songList = songsToUse.map((s, i) => `${i + 1}. 《${s.name}》- ${s.singer}`).join('\n')
  const genreName = GENRE_NAMES[genre]
  const genrePrompt = GENRE_PROMPTS[genre]

  // 生成大纲
  const outlinePrompt = `请为一部${genreName}风格的音乐小说创作大纲。

小说将融入以下歌曲（每章一首）：
${songList}

${genrePrompt}

请输出：
1. 小说标题（吸引人的中文标题）
2. 一句话简介（不超过50字）
3. 每章标题（共${songsToUse.length}章，每章标题需要与对应的歌曲名有关联）

格式：
标题：xxx
简介：xxx
章节：
1. xxx
2. xxx
...`

  try {
    const outlineResult = await chat(outlinePrompt, [])
    if (!outlineResult?.trim()) {
      addDevLog('error', 'MusicNovel', '大纲生成失败')
      return null
    }

    const { title: novelTitle, description, chapterTitles } = parseOutline(outlineResult, songsToUse.length)

    const novel: MusicNovel = {
      id: `novel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: novelTitle || title || `${genreName}物语`,
      genre,
      description: description || '一首歌，一个故事',
      chapters: [],
      totalWords: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // 生成章节
    for (let i = 0; i < songsToUse.length; i++) {
      const chapter = await generateChapter(novel, songsToUse[i], i, chapterTitles[i] || `第${i + 1}章`)
      if (chapter) {
        novel.chapters.push(chapter)
        novel.totalWords += chapter.wordCount
      }
      // 避免频率过高
      if (i < songsToUse.length - 1) {
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    novel.updatedAt = Date.now()
    await saveNovel(novel)
    addDevLog('info', 'MusicNovel', `小说"${novel.title}"创建完成: ${novel.chapters.length}章, ${novel.totalWords}字`)
    return novel
  } catch (e: any) {
    addDevLog('error', 'MusicNovel', `创建失败: ${e?.message}`)
    return null
  }
}

/** 解析大纲 */
const parseOutline = (result: string, expectedChapters: number): {
  title: string
  description: string
  chapterTitles: string[]
} => {
  let title = ''
  let description = ''
  const chapterTitles: string[] = []

  const titleMatch = result.match(/标题[:：]\s*(.+)/i)
  if (titleMatch) title = titleMatch[1].trim()

  const descMatch = result.match(/简介[:：]\s*(.+)/i)
  if (descMatch) description = descMatch[1].trim()

  const chapterRegex = /\d+[\.\、]\s*(.+)/g
  let match
  while ((match = chapterRegex.exec(result)) !== null) {
    chapterTitles.push(match[1].trim())
  }

  return { title, description, chapterTitles }
}

/** 生成单章 */
const generateChapter = async (
  novel: MusicNovel,
  song: MusicInfo,
  index: number,
  chapterTitle: string,
): Promise<NovelChapter | null> => {
  const prevSummary = novel.chapters.slice(-2).map((c) => c.summary).join('\n')
  const genreName = GENRE_NAMES[novel.genre]

  const prompt = `请为${genreName}小说《${novel.title}》续写第${index + 1}章。

${prevSummary ? `前情提要：\n${prevSummary}\n` : ''}
本章歌曲：《${song.name}》- ${song.singer}
本章标题：${chapterTitle}

要求：
1. 字数约500-800字
2. 将歌曲《${song.name}》自然地融入情节（可以是主角听到的歌、歌词暗示的情节、歌名的意象等）
3. 保持与前文风格一致
4. 章节结尾处给出1-2句话的本章摘要

格式：
正文：
xxx

摘要：xxx`

  try {
    const result = await chat(prompt, [])
    if (!result?.trim()) return null

    const { content, summary } = parseChapterResult(result)

    return {
      index: index + 1,
      title: chapterTitle,
      content: content || '',
      song,
      summary: summary || `第${index + 1}章：${chapterTitle}`,
      createdAt: Date.now(),
      wordCount: (content || '').length,
    }
  } catch {
    return null
  }
}

/** 解析章节结果 */
const parseChapterResult = (result: string): { content: string; summary: string } => {
  let content = result.trim()
  let summary = ''

  const summaryMatch = content.match(/摘要[:：]\s*(.+)/i)
  if (summaryMatch) {
    summary = summaryMatch[1].trim()
    content = content.slice(0, summaryMatch.index).trim()
  }

  content = content.replace(/^正文[:：]\s*/i, '').trim()
  return { content, summary }
}

/** 保存小说 */
const saveNovel = async (novel: MusicNovel): Promise<void> => {
  const all = await getAllNovels()
  const idx = all.findIndex((n) => n.id === novel.id)
  if (idx >= 0) {
    all[idx] = novel
  } else {
    all.unshift(novel)
  }
  await saveData(NOVELS_KEY, all.slice(0, MAX_NOVELS))
}

/** 获取所有小说 */
export const getAllNovels = async (): Promise<MusicNovel[]> => {
  const data = await getData<MusicNovel[]>(NOVELS_KEY)
  return data || []
}

/** 获取单个小说 */
export const getNovelById = async (id: string): Promise<MusicNovel | null> => {
  const all = await getAllNovels()
  return all.find((n) => n.id === id) || null
}

/** 删除小说 */
export const deleteNovel = async (id: string): Promise<void> => {
  const all = await getAllNovels()
  await saveData(NOVELS_KEY, all.filter((n) => n.id !== id))
  addDevLog('info', 'MusicNovel', `删除小说: ${id}`)
}

/** 续写章节 */
export const appendChapter = async (
  novelId: string,
  song: MusicInfo,
  chapterTitle?: string,
): Promise<NovelChapter | null> => {
  const novel = await getNovelById(novelId)
  if (!novel) return null

  const nextIndex = novel.chapters.length + 1
  const title = chapterTitle || `第${nextIndex}章`

  const chapter = await generateChapter(novel, song, nextIndex - 1, title)
  if (chapter) {
    novel.chapters.push(chapter)
    novel.totalWords += chapter.wordCount
    novel.updatedAt = Date.now()
    await saveNovel(novel)
  }
  return chapter
}

/** 获取类型名 */
export const getGenreName = (genre: NovelGenre): string => GENRE_NAMES[genre]

/** 获取所有类型 */
export const getAllGenres = (): Array<{ key: NovelGenre; name: string; desc: string }> =>
  Object.entries(GENRE_NAMES).map(([key, name]) => ({
    key: key as NovelGenre,
    name,
    desc: GENRE_PROMPTS[key as NovelGenre],
  }))

/** 清空所有小说 */
export const clearAllNovels = async (): Promise<void> => {
  await saveData(NOVELS_KEY, [])
  addDevLog('info', 'MusicNovel', '所有小说已清空')
}

/** 获取小说预览（前100字） */
export const getNovelPreview = (novel: MusicNovel): string => {
  if (novel.chapters.length === 0) return '暂无章节'
  return novel.chapters[0].content.slice(0, 100) + '...'
}