/**
 * 音乐发现雷达
 * 多维度发现新音乐：热门趋势、相似用户、跨平台推荐
 */
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export type RadarType =
  | 'trending'    // 热门趋势
  | 'new_release' // 新歌首发
  | 'undiscovered' // 小众宝藏
  | 'similar_users' // 相似用户在听
  | 'cross_source'  // 跨平台热门
  | 'seasonal'    // 季节性推荐
  | 'time_based'  // 时段推荐

export interface RadarItem {
  musicInfo: MusicInfo
  type: RadarType
  score: number
  reason: string
  metadata?: {
    playCount?: number
    trendScore?: number
    freshness?: number
  }
}

export interface RadarConfig {
  enabled: boolean
  types: RadarType[]
  excludeArtists: string[]
  excludeGenres: string[]
  minScore: number
  maxResults: number
}

const DEFAULT_CONFIG: RadarConfig = {
  enabled: false,
  types: ['trending', 'new_release', 'undiscovered', 'similar_users', 'seasonal', 'time_based'],
  excludeArtists: [],
  excludeGenres: [],
  minScore: 0.3,
  maxResults: 50,
}

let currentConfig: RadarConfig = { ...DEFAULT_CONFIG }

export const getRadarConfig = (): RadarConfig => ({ ...currentConfig })
export const updateRadarConfig = (config: Partial<RadarConfig>) => {
  currentConfig = { ...currentConfig, ...config }
}

/** 扫描热门趋势 */
export const scanTrending = async (candidates: MusicInfo[]): Promise<RadarItem[]> => {
  const results: RadarItem[] = []
  const now = Date.now()

  for (const song of candidates) {
    const trendScore = calculateTrendScore(song, now)
    if (trendScore >= currentConfig.minScore) {
      results.push({
        musicInfo: song,
        type: 'trending',
        score: trendScore,
        reason: '🔥 近期热门趋势',
        metadata: { trendScore },
      })
    }
  }

  results.sort((a, b) => b.score - a.score)
  addDevLog('info', 'MusicRadar', `扫描到${results.length}首热门趋势歌曲`)
  return results.slice(0, currentConfig.maxResults)
}

/** 发现小众宝藏（低播放量但高完整播放率） */
export const discoverUndiscovered = async (
  candidates: Array<{ song: MusicInfo; playCount: number; completionRate: number }>,
): Promise<RadarItem[]> => {
  const results: RadarItem[] = []

  for (const item of candidates) {
    // 播放量低但完整播放率高 = 小众宝藏
    if (item.playCount < 100 && item.completionRate > 0.7) {
      const score = item.completionRate * (1 - Math.min(item.playCount / 100, 1))
      if (score >= currentConfig.minScore) {
        results.push({
          musicInfo: item.song,
          type: 'undiscovered',
          score,
          reason: '💎 小众宝藏歌曲',
          metadata: { playCount: item.playCount },
        })
      }
    }
  }

  results.sort((a, b) => b.score - a.score)
  addDevLog('info', 'MusicRadar', `发现${results.length}首小众宝藏`)
  return results.slice(0, currentConfig.maxResults / 2)
}

/** 季节性推荐 */
export const seasonalRecommend = async (candidates: MusicInfo[]): Promise<RadarItem[]> => {
  const month = new Date().getMonth()
  const season = getSeason(month)
  const seasonKeywords = SEASON_KEYWORDS[season]

  const results: RadarItem[] = []
  for (const song of candidates) {
    const text = (song.name + song.singer).toLowerCase()
    for (const kw of seasonKeywords) {
      if (text.includes(kw.toLowerCase())) {
        results.push({
          musicInfo: song,
          type: 'seasonal',
          score: 0.7,
          reason: `🍂 ${season}季节推荐`,
        })
        break
      }
    }
  }

  addDevLog('info', 'MusicRadar', `季节推荐: ${results.length}首 (${season})`)
  return results
}

/** 时段推荐 */
export const timeBasedRecommend = async (candidates: MusicInfo[]): Promise<RadarItem[]> => {
  const hour = new Date().getHours()
  const period = getTimePeriod(hour)
  const periodKeywords = PERIOD_KEYWORDS[period]

  const results: RadarItem[] = []
  for (const song of candidates) {
    const text = (song.name + song.singer).toLowerCase()
    for (const kw of periodKeywords) {
      if (text.includes(kw.toLowerCase())) {
        results.push({
          musicInfo: song,
          type: 'time_based',
          score: 0.6,
          reason: `⏰ ${period}时段推荐`,
        })
        break
      }
    }
  }

  return results
}

/** 综合雷达扫描 */
export const fullRadarScan = async (
  candidates: MusicInfo[],
  playStats?: Array<{ song: MusicInfo; playCount: number; completionRate: number }>,
): Promise<RadarItem[]> => {
  if (!currentConfig.enabled) return []

  const allResults: RadarItem[] = []
  const types = currentConfig.types

  if (types.includes('trending')) {
    allResults.push(...await scanTrending(candidates))
  }
  if (types.includes('seasonal')) {
    allResults.push(...await seasonalRecommend(candidates))
  }
  if (types.includes('time_based')) {
    allResults.push(...await timeBasedRecommend(candidates))
  }
  if (types.includes('undiscovered') && playStats) {
    allResults.push(...await discoverUndiscovered(playStats))
  }

  // 去重（同一首歌保留最高分）
  const songMap = new Map<string, RadarItem>()
  for (const item of allResults) {
    const existing = songMap.get(item.musicInfo.id)
    if (!existing || item.score > existing.score) {
      songMap.set(item.musicInfo.id, item)
    }
  }

  // 过滤排除项
  const filtered = Array.from(songMap.values()).filter((item) => {
    if (currentConfig.excludeArtists.some((a) => item.musicInfo.singer.includes(a))) return false
    return true
  })

  filtered.sort((a, b) => b.score - a.score)
  addDevLog('info', 'MusicRadar', `全雷达扫描完成，共${filtered.length}首推荐`)
  return filtered.slice(0, currentConfig.maxResults)
}

const calculateTrendScore = (song: MusicInfo, now: number): number => {
  // 简化实现：基于歌曲名特征估算
  const text = song.name.toLowerCase()
  let score = 0.3
  if (/新|new|最新|2024|2025|2026/.test(text)) score += 0.3
  if (/热|hot|火|爆|流行/.test(text)) score += 0.2
  if (/推荐|recommend|精选/.test(text)) score += 0.1
  return Math.min(score, 1)
}

const getSeason = (month: number): string => {
  if (month >= 2 && month <= 4) return '春季'
  if (month >= 5 && month <= 7) return '夏季'
  if (month >= 8 && month <= 10) return '秋季'
  return '冬季'
}

const getTimePeriod = (hour: number): string => {
  if (hour >= 5 && hour < 11) return '早晨'
  if (hour >= 11 && hour < 14) return '中午'
  if (hour >= 14 && hour < 18) return '下午'
  if (hour >= 18 && hour < 22) return '晚上'
  return '深夜'
}

const SEASON_KEYWORDS: Record<string, string[]> = {
  '春季': ['春', '花', '绿', '希望', '新生', 'spring'],
  '夏季': ['夏', '海', '阳光', '热', '海滩', 'summer'],
  '秋季': ['秋', '落叶', '枫', '思念', '回忆', 'autumn'],
  '冬季': ['冬', '雪', '寒冷', '温暖', '圣诞', 'winter'],
}

const PERIOD_KEYWORDS: Record<string, string[]> = {
  '早晨': ['早', '晨', '阳光', '希望', '开始', 'morning'],
  '中午': ['午', '休息', '轻松', 'relax'],
  '下午': ['下午', '茶', '惬意', '悠然'],
  '晚上': ['夜', '晚', '月', '星', 'night', 'moon'],
  '深夜': ['深夜', '寂寞', '孤独', '思念', '泪', 'midnight'],
}

/** 获取雷达统计 */
export const getRadarStats = (results: RadarItem[]): Record<string, number> => {
  const stats: Record<string, number> = {}
  for (const item of results) {
    stats[item.type] = (stats[item.type] || 0) + 1
  }
  return stats
}
