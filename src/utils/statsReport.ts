/**
 * 播放统计报告工具
 * 生成周报/月报听歌数据
 */
import { getPlayHistoryByRange } from '@/core/player/playHistory'

export interface StatsReport {
  totalPlays: number
  totalTime: number // 秒
  uniqueSongs: number
  uniqueArtists: number
  topSongs: Array<{ name: string; singer: string; count: number }>
  topArtists: Array<{ name: string; count: number; totalTime: number }>
  topSources: Array<{ source: string; count: number }>
  dailyAverage: number
  startDate: string
  endDate: string
}

/** 获取日期范围的开始时间 */
const getRangeStart = (range: 'week' | 'month'): number => {
  const now = new Date()
  if (range === 'week') {
    // 本周一 00:00
    const day = now.getDay() || 7
    now.setDate(now.getDate() - day + 1)
  } else {
    // 本月1日 00:00
    now.setDate(1)
  }
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

/** 格式化日期 */
const formatDate = (timestamp: number): string => {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 格式化时长 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

/** 生成播放统计报告 */
export const generateStatsReport = async (range: 'week' | 'month'): Promise<StatsReport | null> => {
  const endTime = Date.now()
  const startTime = getRangeStart(range)
  const history = await getPlayHistoryByRange(startTime, endTime)

  if (history.length === 0) return null

  const songMap = new Map<string, { name: string; singer: string; count: number }>()
  const artistMap = new Map<string, { name: string; count: number; totalTime: number }>()
  const sourceMap = new Map<string, number>()
  let totalTime = 0

  for (const item of history) {
    const songKey = `${item.musicInfo.name}_${item.musicInfo.singer}`
    if (songMap.has(songKey)) {
      songMap.get(songKey)!.count++
    } else {
      songMap.set(songKey, {
        name: item.musicInfo.name,
        singer: item.musicInfo.singer,
        count: 1,
      })
    }

    const artist = item.musicInfo.singer
    if (artistMap.has(artist)) {
      const a = artistMap.get(artist)!
      a.count++
      a.totalTime += item.playTime
    } else {
      artistMap.set(artist, {
        name: artist,
        count: 1,
        totalTime: item.playTime,
      })
    }

    const source = item.source || 'Unknown'
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1)

    totalTime += item.playTime
  }

  const uniqueArtists = Array.from(new Set(history.map(h => h.musicInfo.singer)))
  const uniqueSongs = Array.from(new Set(history.map(h => `${h.musicInfo.name}_${h.musicInfo.singer}`)))

  const days = Math.max(1, Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000)))

  return {
    totalPlays: history.length,
    totalTime,
    uniqueSongs: uniqueSongs.length,
    uniqueArtists: uniqueArtists.length,
    topSongs: Array.from(songMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topArtists: Array.from(artistMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topSources: Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    dailyAverage: Math.round(history.length / days),
    startDate: formatDate(startTime),
    endDate: formatDate(endTime),
  }
}