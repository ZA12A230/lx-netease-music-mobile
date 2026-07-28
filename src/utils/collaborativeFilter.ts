/**
 * 协同过滤推荐引擎
 * 基于用户听歌行为相似度进行推荐
 */
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export interface UserBehavior {
  /** 歌曲ID → 播放次数 */
  plays: Record<string, number>
  /** 歌曲ID → 是否收藏 */
  favorites: Record<string, boolean>
  /** 歌曲ID → 跳过次数 */
  skips: Record<string, number>
  /** 歌曲ID → 完整播放次数 */
  completions: Record<string, number>
}

export interface SimilarityScore {
  songId: string
  score: number // 0-1
  reason: string
}

export interface RecommendItem {
  musicInfo: MusicInfo
  score: number
  reasons: string[]
}

const BEHAVIOR_KEY = '@cf_behavior_v1'
const MATRIX_KEY = '@cf_matrix_v1'

/** 记录播放行为 */
export const recordPlay = async (songId: string): Promise<void> => {
  const behavior = await getBehavior()
  behavior.plays[songId] = (behavior.plays[songId] || 0) + 1
  await saveData(BEHAVIOR_KEY, behavior)
}

/** 记录收藏 */
export const recordFavorite = async (songId: string, favorite: boolean): Promise<void> => {
  const behavior = await getBehavior()
  behavior.favorites[songId] = favorite
  await saveData(BEHAVIOR_KEY, behavior)
}

/** 记录跳过 */
export const recordSkip = async (songId: string): Promise<void> => {
  const behavior = await getBehavior()
  behavior.skips[songId] = (behavior.skips[songId] || 0) + 1
  await saveData(BEHAVIOR_KEY, behavior)
}

/** 记录完整播放 */
export const recordCompletion = async (songId: string): Promise<void> => {
  const behavior = await getBehavior()
  behavior.completions[songId] = (behavior.completions[songId] || 0) + 1
  await saveData(BEHAVIOR_KEY, behavior)
}

/** 获取用户行为数据 */
export const getBehavior = async (): Promise<UserBehavior> => {
  const data = await getData<UserBehavior>(BEHAVIOR_KEY)
  return data || { plays: {}, favorites: {}, skips: {}, completions: {} }
}

/** 计算歌曲评分（用户偏好） */
export const calculateSongScore = (songId: string, behavior: UserBehavior): number => {
  const plays = behavior.plays[songId] || 0
  const completions = behavior.completions[songId] || 0
  const skips = behavior.skips[songId] || 0
  const favorite = behavior.favorites[songId] ? 1 : 0

  // 评分公式：完整播放率 × 0.4 + 收藏 × 0.3 + 播放次数归一化 × 0.2 - 跳过率 × 0.1
  const playRate = plays > 0 ? completions / plays : 0
  const skipRate = plays > 0 ? skips / plays : 0
  const playNormalized = Math.min(plays / 20, 1) // 20次播放为满分

  return Math.max(0, Math.min(1, playRate * 0.4 + favorite * 0.3 + playNormalized * 0.2 - skipRate * 0.1))
}

/** 基于歌手/歌曲相似度推荐 */
export const recommendBySimilarity = async (
  candidateSongs: MusicInfo[],
  topN = 20,
): Promise<RecommendItem[]> => {
  const behavior = await getBehavior()

  // 构建用户喜欢的歌手集合
  const likedArtists = new Set<string>()
  const likedSongs = new Set<string>()
  for (const songId of Object.keys(behavior.plays)) {
    if (calculateSongScore(songId, behavior) > 0.5) {
      likedSongs.add(songId)
    }
  }

  const recommendations: RecommendItem[] = []

  for (const song of candidateSongs) {
    if (likedSongs.has(song.id)) continue // 跳过已听过的

    const reasons: string[] = []
    let score = 0

    // 歌手匹配
    if (likedArtists.has(song.singer)) {
      score += 0.3
      reasons.push(`你常听 ${song.singer} 的歌`)
    }

    // 基于歌手名相似度
    for (const artist of likedArtists) {
      if (song.singer.includes(artist) || artist.includes(song.singer)) {
        score += 0.2
        reasons.push(`${song.singer} 与你喜欢的 ${artist} 相似`)
        break
      }
    }

    // 歌名关键词匹配
    const userKeywords = extractKeywords(likedSongs)
    const songKeywords = extractKeywordsFromText(song.name)
    const commonKeywords = userKeywords.filter((k) => songKeywords.includes(k))
    if (commonKeywords.length > 0) {
      score += 0.1 * commonKeywords.length
      reasons.push(`歌名包含关键词: ${commonKeywords.join(', ')}`)
    }

    if (score > 0) {
      recommendations.push({ musicInfo: song, score, reasons })
    }
  }

  recommendations.sort((a, b) => b.score - a.score)
  addDevLog('info', 'CollaborativeFilter', `协同过滤推荐了${Math.min(topN, recommendations.length)}首歌`)
  return recommendations.slice(0, topN)
}

/** 提取关键词（简化版） */
const extractKeywords = (songIds: Set<string>): string[] => {
  // 简化实现：返回空数组，实际可以从歌曲名提取
  return []
}

const extractKeywordsFromText = (text: string): string[] => {
  // 提取2字以上的中文词
  const matches = text.match(/[\u4e00-\u9fa5]{2,}/g) || []
  return matches
}

/** 获取推荐统计 */
export const getRecommendStats = async () => {
  const behavior = await getBehavior()
  const songs = Object.keys(behavior.plays)
  const totalPlays = songs.reduce((sum, id) => sum + behavior.plays[id], 0)
  const totalCompletions = songs.reduce((sum, id) => sum + (behavior.completions[id] || 0), 0)
  const totalSkips = songs.reduce((sum, id) => sum + (behavior.skips[id] || 0), 0)
  const favorites = Object.values(behavior.favorites).filter(Boolean).length

  return {
    uniqueSongs: songs.length,
    totalPlays,
    totalCompletions,
    totalSkips,
    favorites,
    completionRate: totalPlays > 0 ? totalCompletions / totalPlays : 0,
    skipRate: totalPlays > 0 ? totalSkips / totalPlays : 0,
  }
}

/** 清空行为数据 */
export const clearBehavior = async (): Promise<void> => {
  await saveData(BEHAVIOR_KEY, null)
  await saveData(MATRIX_KEY, null)
  addDevLog('info', 'CollaborativeFilter', '行为数据已清空')
}
