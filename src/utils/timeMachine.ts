/**
 * 音乐时光机
 * 回顾历史听歌记录，"X年前的今天你在听什么"
 */
import { getPlayHistoryByRange } from '@/core/player/playHistory'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export interface TimeMachineEntry {
  date: string // YYYY-MM-DD
  songs: Array<{
    musicInfo: MusicInfo
    playCount: number
    firstPlayedAt: number
    lastPlayedAt: number
  }>
  totalPlays: number
  uniqueSongs: number
  topSong?: { name: string; singer: string; count: number }
  mood: string
  summary: string
}

export interface TimeMachineReport {
  yearAgo: number
  date: string
  entries: TimeMachineEntry[]
  highlights: string[]
}

const HISTORY_KEY = '@time_machine_history_v1'

/** 记录今日听歌 */
export const recordTodayListening = async (): Promise<void> => {
  const today = new Date()
  const todayStr = formatDate(today)

  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setHours(23, 59, 59, 999)

  const history = await getPlayHistoryByRange(start.getTime(), end.getTime())
  if (history.length === 0) return

  const songMap = new Map<string, { musicInfo: MusicInfo; playCount: number; firstPlayedAt: number; lastPlayedAt: number }>()

  for (const item of history as any[]) {
    const songId = item.musicInfo?.id
    if (!songId) continue
    const existing = songMap.get(songId)
    if (existing) {
      existing.playCount++
      existing.lastPlayedAt = item.playedAt || existing.lastPlayedAt
    } else {
      songMap.set(songId, {
        musicInfo: item.musicInfo,
        playCount: 1,
        firstPlayedAt: item.playedAt || Date.now(),
        lastPlayedAt: item.playedAt || Date.now(),
      })
    }
  }

  const songs = Array.from(songMap.values()).sort((a, b) => b.playCount - a.playCount)
  const totalPlays = songs.reduce((sum, s) => sum + s.playCount, 0)

  const entry: TimeMachineEntry = {
    date: todayStr,
    songs,
    totalPlays,
    uniqueSongs: songs.length,
    topSong: songs[0] ? { name: songs[0].musicInfo.name, singer: songs[0].musicInfo.singer, count: songs[0].playCount } : undefined,
    mood: inferMoodFromSongs(songs.map((s) => s.musicInfo.name)),
    summary: generateSummary(todayStr, totalPlays, songs.length, songs[0]?.musicInfo.name),
  }

  // 保存到历史
  const allHistory = await getAllHistory()
  allHistory[todayStr] = entry
  await saveData(HISTORY_KEY, allHistory)

  addDevLog('info', 'TimeMachine', `记录${todayStr}听歌: ${totalPlays}次播放`)
}

/** 获取X年前的今天 */
export const getYearsAgoToday = async (yearsAgo: number): Promise<TimeMachineReport | null> => {
  const today = new Date()
  const targetDate = new Date(today)
  targetDate.setFullYear(today.getFullYear() - yearsAgo)
  const targetStr = formatDate(targetDate)

  const allHistory = await getAllHistory()
  const entry = allHistory[targetStr]

  if (!entry) return null

  const highlights: string[] = []
  highlights.push(`${yearsAgo}年前的今天（${targetStr}）你听了${entry.totalPlays}次音乐`)
  if (entry.topSong) {
    highlights.push(`最常听: 《${entry.topSong.name}》- ${entry.topSong.singer} (${entry.topSong.count}次)`)
  }
  highlights.push(`心情: ${entry.mood}`)
  highlights.push(`共听了${entry.uniqueSongs}首不同的歌`)

  return {
    yearAgo,
    date: targetStr,
    entries: [entry],
    highlights,
  }
}

/** 获取本月历史 */
export const getThisMonthHistory = async (): Promise<TimeMachineEntry[]> => {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const allHistory = await getAllHistory()
  return Object.values(allHistory)
    .filter((entry) => entry.date.startsWith(yearMonth))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** 获取某日历史 */
export const getHistoryByDate = async (date: Date): Promise<TimeMachineEntry | null> => {
  const dateStr = formatDate(date)
  const allHistory = await getAllHistory()
  return allHistory[dateStr] || null
}

/** 获取所有历史 */
export const getAllHistory = async (): Promise<Record<string, TimeMachineEntry>> => {
  const data = await getData<Record<string, TimeMachineEntry>>(HISTORY_KEY)
  return data || {}
}

/** 生成年度回顾报告 */
export const generateYearReport = async (year: number): Promise<string> => {
  const allHistory = await getAllHistory()
  const yearEntries = Object.values(allHistory).filter((e) => e.date.startsWith(String(year)))

  if (yearEntries.length === 0) return `${year}年没有听歌记录`

  const totalPlays = yearEntries.reduce((sum, e) => sum + e.totalPlays, 0)
  const allSongs = new Map<string, { name: string; singer: string; count: number }>()

  for (const entry of yearEntries) {
    for (const song of entry.songs) {
      const key = song.musicInfo.id
      const existing = allSongs.get(key)
      if (existing) {
        existing.count += song.playCount
      } else {
        allSongs.set(key, {
          name: song.musicInfo.name,
          singer: song.musicInfo.singer,
          count: song.playCount,
        })
      }
    }
  }

  const topSongs = Array.from(allSongs.values()).sort((a, b) => b.count - a.count).slice(0, 10)
  const topSong = topSongs[0]

  let report = `📅 ${year}年音乐回顾\n\n`
  report += `📊 总播放次数: ${totalPlays}\n`
  report += `🎵 听过的歌曲数: ${allSongs.size}\n`
  report += `📅 有记录的天数: ${yearEntries.length}\n\n`

  if (topSong) {
    report += `🏆 年度之歌: 《${topSong.name}》- ${topSong.singer} (${topSong.count}次)\n\n`
  }

  report += `🔝 Top 10 歌曲:\n`
  topSongs.forEach((song, idx) => {
    report += `${idx + 1}. ${song.name} - ${song.singer} (${song.count}次)\n`
  })

  return report
}

const formatDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const inferMoodFromSongs = (songNames: string[]): string => {
  if (songNames.length === 0) return '未知'
  const text = songNames.join(' ')
  if (/快乐|开心|阳光|happy/.test(text)) return '愉悦 😊'
  if (/悲伤|泪|伤心|sad/.test(text)) return '感伤 😢'
  if (/爱|情|心|love/.test(text)) return '浪漫 ❤️'
  if (/摇滚|rock|热血|燃烧/.test(text)) return '激昂 🔥'
  if (/夜|moon|静|calm/.test(text)) return '宁静 🌙'
  return '平静 😌'
}

const generateSummary = (date: string, totalPlays: number, uniqueSongs: number, topSong?: string): string => {
  let summary = `${date}：听了${totalPlays}次`
  if (topSong) summary += `，最爱《${topSong}》`
  if (uniqueSongs > 0) summary += `，共${uniqueSongs}首歌`
  return summary
}

/** 清空历史 */
export const clearHistory = async (): Promise<void> => {
  await saveData(HISTORY_KEY, {})
  addDevLog('info', 'TimeMachine', '时光机历史已清空')
}
