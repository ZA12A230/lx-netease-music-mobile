/**
 * 音乐知识库
 * 提供歌曲背景故事、创作故事、专辑信息等
 */
import { chat } from '@/core/ai'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export interface SongKnowledge {
  songId: string
  songName: string
  singer: string
  /** 发行日期 */
  releaseDate?: string
  /** 所属专辑 */
  album?: string
  /** 创作背景 */
  background?: string
  /** 歌曲含义 */
  meaning?: string
  /** 制作团队 */
  production?: Array<{
    role: string
    name: string
  }>
  /** 趣闻轶事 */
  trivia?: string[]
  /** 歌词主题 */
  themes?: string[]
  /** 音乐风格 */
  genres?: string[]
  /** 乐器 */
  instruments?: string[]
  /** 获奖 */
  awards?: string[]
  /** 商业成绩 */
  chartPerformance?: string
  /** 文化影响 */
  culturalImpact?: string
  /** 相似歌曲推荐 */
  similarSongs?: Array<{ name: string; singer: string; reason: string }>
  timestamp: number
}

export interface ArtistKnowledge {
  artistId: string
  name: string
  /** 简介 */
  bio?: string
  /** 成立时间/出生日期 */
  established?: string
  /** 国籍 */
  nationality?: string
  /** 流派 */
  genres?: string[]
  /** 代表作 */
  topSongs?: string[]
  /** 专辑数 */
  albumCount?: number
  /** 成员（乐队） */
  members?: Array<{ name: string; role: string }>
  /** 奖项 */
  awards?: string[]
  /** 趣闻 */
  trivia?: string[]
  timestamp: number
}

const SONG_CACHE_KEY = '@song_knowledge_v1'
const ARTIST_CACHE_KEY = '@artist_knowledge_v1'

/** 获取歌曲知识 */
export const getSongKnowledge = async (song: MusicInfo): Promise<SongKnowledge | null> => {
  // 检查缓存
  const cache = await getSongCache()
  if (cache[song.id] && Date.now() - cache[song.id].timestamp < 60 * 24 * 60 * 60 * 1000) {
    return cache[song.id]
  }

  try {
    const prompt = `请提供歌曲《${song.name}》- ${song.singer} 的详细信息，包括:
1. 创作背景
2. 歌曲含义
3. 制作团队
4. 趣闻轶事
5. 歌词主题
6. 音乐风格
7. 使用的乐器
8. 获奖情况
9. 商业成绩
10. 文化影响
11. 3-5首相似歌曲推荐

以JSON格式返回:
{
  "releaseDate": "发行日期",
  "album": "专辑名",
  "background": "创作背景",
  "meaning": "歌曲含义",
  "production": [{"role": "制作人", "name": "姓名"}],
  "trivia": ["趣闻1", "趣闻2"],
  "themes": ["主题1"],
  "genres": ["流派1"],
  "instruments": ["乐器1"],
  "awards": ["奖项1"],
  "chartPerformance": "榜单成绩",
  "culturalImpact": "文化影响",
  "similarSongs": [{"name": "歌名", "singer": "歌手", "reason": "推荐原因"}]
}`

    const result = await chat(prompt)
    if (!result) return null

    let parsed: any
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      return null
    }

    if (!parsed) return null

    const knowledge: SongKnowledge = {
      songId: song.id,
      songName: song.name,
      singer: song.singer,
      ...parsed,
      timestamp: Date.now(),
    }

    cache[song.id] = knowledge
    await saveData(SONG_CACHE_KEY, cache)

    addDevLog('info', 'MusicKnowledge', `获取歌曲知识: ${song.name}`)
    return knowledge
  } catch (e: any) {
    addDevLog('error', 'MusicKnowledge', `获取失败: ${e?.message}`)
    return null
  }
}

/** 获取歌手知识 */
export const getArtistKnowledge = async (artistName: string): Promise<ArtistKnowledge | null> => {
  const artistId = `artist_${artistName}`
  const cache = await getArtistCache()
  if (cache[artistId] && Date.now() - cache[artistId].timestamp < 60 * 24 * 60 * 60 * 1000) {
    return cache[artistId]
  }

  try {
    const prompt = `请提供歌手/乐队"${artistName}"的详细信息:
1. 简介
2. 成立时间或出生日期
3. 国籍
4. 音乐流派
5. 代表作品
6. 专辑数量
7. 成员（如果是乐队）
8. 获得奖项
9. 趣闻轶事

以JSON格式返回:
{
  "bio": "简介",
  "established": "成立时间",
  "nationality": "国籍",
  "genres": ["流派"],
  "topSongs": ["代表作1"],
  "albumCount": 数量,
  "members": [{"name": "姓名", "role": "角色"}],
  "awards": ["奖项"],
  "trivia": ["趣闻"]
}`

    const result = await chat(prompt)
    if (!result) return null

    let parsed: any
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      return null
    }

    if (!parsed) return null

    const knowledge: ArtistKnowledge = {
      artistId,
      name: artistName,
      ...parsed,
      timestamp: Date.now(),
    }

    cache[artistId] = knowledge
    await saveData(ARTIST_CACHE_KEY, cache)

    addDevLog('info', 'MusicKnowledge', `获取歌手知识: ${artistName}`)
    return knowledge
  } catch (e: any) {
    addDevLog('error', 'MusicKnowledge', `获取失败: ${e?.message}`)
    return null
  }
}

/** 生成歌曲百科卡片 */
export const generateSongCard = (knowledge: SongKnowledge): string => {
  let card = `🎵 《${knowledge.songName}》- ${knowledge.singer}\n\n`

  if (knowledge.album) card += `💿 专辑: ${knowledge.album}\n`
  if (knowledge.releaseDate) card += `📅 发行: ${knowledge.releaseDate}\n`
  if (knowledge.genres?.length) card += `🎶 流派: ${knowledge.genres.join(', ')}\n`

  if (knowledge.background) {
    card += `\n📖 创作背景:\n${knowledge.background}\n`
  }
  if (knowledge.meaning) {
    card += `\n💡 歌曲含义:\n${knowledge.meaning}\n`
  }
  if (knowledge.trivia?.length) {
    card += `\n🎯 趣闻轶事:\n`
    knowledge.trivia.forEach((t, i) => {
      card += `${i + 1}. ${t}\n`
    })
  }
  if (knowledge.themes?.length) {
    card += `\n🏷️ 主题: ${knowledge.themes.join('、')}\n`
  }
  if (knowledge.awards?.length) {
    card += `\n🏆 获奖:\n`
    knowledge.awards.forEach((a) => {
      card += `• ${a}\n`
    })
  }
  if (knowledge.similarSongs?.length) {
    card += `\n🎵 相似歌曲推荐:\n`
    knowledge.similarSongs.forEach((s) => {
      card += `• 《${s.name}》- ${s.singer} (${s.reason})\n`
    })
  }

  return card
}

/** 搜索知识库 */
export const searchKnowledge = async (keyword: string): Promise<{
  songs: SongKnowledge[]
  artists: ArtistKnowledge[]
}> => {
  const songCache = await getSongCache()
  const artistCache = await getArtistCache()

  const songs = Object.values(songCache).filter((k) =>
    k.songName.includes(keyword) || k.singer.includes(keyword) ||
    k.themes?.some((t) => t.includes(keyword)) ||
    k.genres?.some((g) => g.includes(keyword))
  )

  const artists = Object.values(artistCache).filter((k) =>
    k.name.includes(keyword) ||
    k.genres?.some((g) => g.includes(keyword))
  )

  return { songs, artists }
}

const getSongCache = async (): Promise<Record<string, SongKnowledge>> => {
  const data = await getData<Record<string, SongKnowledge>>(SONG_CACHE_KEY)
  return data || {}
}

const getArtistCache = async (): Promise<Record<string, ArtistKnowledge>> => {
  const data = await getData<Record<string, ArtistKnowledge>>(ARTIST_CACHE_KEY)
  return data || {}
}

/** 获取缓存统计 */
export const getKnowledgeCacheStats = async () => {
  const songCache = await getSongCache()
  const artistCache = await getArtistCache()
  return {
    songs: Object.keys(songCache).length,
    artists: Object.keys(artistCache).length,
  }
}

/** 清空知识库缓存 */
export const clearKnowledgeCache = async (): Promise<void> => {
  await saveData(SONG_CACHE_KEY, {})
  await saveData(ARTIST_CACHE_KEY, {})
  addDevLog('info', 'MusicKnowledge', '知识库缓存已清空')
}
