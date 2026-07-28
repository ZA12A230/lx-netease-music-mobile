/**
 * 智能电台
 * 基于曲风/情绪/歌手创建智能电台，自动播放相似歌曲
 */
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
import listState from '@/store/list/state'

type MusicInfo = LX.Music.MusicInfo

export type StationType = 'genre' | 'mood' | 'artist' | 'era' | 'discovery' | 'mix'

export interface StationPreset {
  key: string
  name: string
  type: StationType
  description: string
  icon: string
  seedKeywords: string[]
}

export interface RadioStation {
  id: string
  preset: StationPreset
  customName?: string
  songs: MusicInfo[]
  currentIndex: number
  createdAt: number
  lastPlayedAt?: number
  playCount: number
  favorite: boolean
  /** 自定义种子（用户自行添加的歌曲） */
  seeds: MusicInfo[]
}

export interface StationHistory {
  stationId: string
  songId: string
  playedAt: number
  skipped: boolean
}

const STATIONS_KEY = '@radio_stations_v1'
const HISTORY_KEY = '@radio_history_v1'
const MAX_STATIONS = 15
const MAX_HISTORY = 200

/** 预置电台模板 */
export const STATION_PRESETS: StationPreset[] = [
  {
    key: 'morning',
    name: '早安电台',
    type: 'mood',
    description: '清新活力的早晨音乐，开启美好一天',
    icon: '🌅',
    seedKeywords: ['清新', '活力', '阳光', 'morning', '轻快', 'pop'],
  },
  {
    key: 'night',
    name: '晚安电台',
    type: 'mood',
    description: '舒缓放松的夜晚音乐，助你入眠',
    icon: '🌙',
    seedKeywords: ['舒缓', '安静', 'night', 'slow', '夜', '抒情'],
  },
  {
    key: 'workout',
    name: '运动电台',
    type: 'mood',
    description: '高能量运动音乐，激发你的运动潜能',
    icon: '💪',
    seedKeywords: ['燃', '热血', '摇滚', 'rock', '电子', '快节奏', 'energy'],
  },
  {
    key: 'focus',
    name: '专注电台',
    type: 'mood',
    description: '纯音乐和轻音乐，帮助集中注意力',
    icon: '🎯',
    seedKeywords: ['纯音乐', '钢琴', '轻音乐', 'instrumental', 'study', 'focus'],
  },
  {
    key: 'romance',
    name: '情歌电台',
    type: 'genre',
    description: '甜蜜浪漫的爱情歌曲',
    icon: '💕',
    seedKeywords: ['爱', 'love', '情歌', '浪漫', 'romance', '甜蜜'],
  },
  {
    key: 'nostalgia',
    name: '怀旧电台',
    type: 'era',
    description: '经典老歌回忆杀，重温美好时光',
    icon: '📻',
    seedKeywords: ['经典', '怀旧', '老歌', 'nostalgia', '回忆', '金曲'],
  },
  {
    key: 'discovery',
    name: '探索电台',
    type: 'discovery',
    description: '发现没听过的好歌，拓展音乐视野',
    icon: '🔍',
    seedKeywords: ['独立', '小众', 'indie', '新歌', '冷门'],
  },
  {
    key: 'party',
    name: '派对电台',
    type: 'mix',
    description: '嗨翻全场的派对音乐',
    icon: '🎉',
    seedKeywords: ['舞曲', 'dance', 'dj', 'party', 'club', '电子'],
  },
]

/** 创建电台 */
export const createStation = (
  preset: StationPreset,
  pool: MusicInfo[],
  customName?: string,
): RadioStation | null => {
  const matched = matchSongs(pool, preset.seedKeywords, 50)
  if (matched.length < 5) {
    addDevLog('warn', 'SmartRadio', `电台"${preset.name}"匹配歌曲不足: ${matched.length}首`)
    return null
  }

  return {
    id: `radio_${preset.key}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    preset,
    customName,
    songs: matched,
    currentIndex: 0,
    createdAt: Date.now(),
    playCount: 0,
    favorite: false,
    seeds: [],
  }
}

/** 关键词匹配歌曲（启发式） */
const matchSongs = (pool: MusicInfo[], keywords: string[], limit: number): MusicInfo[] => {
  const scored: Array<{ song: MusicInfo; score: number }> = []

  for (const song of pool) {
    const text = (song.name + song.singer).toLowerCase()
    let score = 0
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        score += 10
      }
    }
    if (score > 0) {
      scored.push({ song, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.song)
}

/** 保存电台 */
export const saveStation = async (station: RadioStation): Promise<void> => {
  const all = await getAllStations()
  const idx = all.findIndex((s) => s.id === station.id)
  if (idx >= 0) {
    all[idx] = station
  } else {
    all.unshift(station)
  }
  await saveData(STATIONS_KEY, all.slice(0, MAX_STATIONS))
}

/** 获取所有电台 */
export const getAllStations = async (): Promise<RadioStation[]> => {
  const data = await getData<RadioStation[]>(STATIONS_KEY)
  return data || []
}

/** 获取当前歌曲 */
export const getCurrentSong = (station: RadioStation): MusicInfo | null => {
  if (station.songs.length === 0) return null
  return station.songs[station.currentIndex] || null
}

/** 下一首 */
export const nextSong = (station: RadioStation): MusicInfo | null => {
  if (station.songs.length === 0) return null
  station.currentIndex = (station.currentIndex + 1) % station.songs.length
  return station.songs[station.currentIndex]
}

/** 上一首 */
export const prevSong = (station: RadioStation): MusicInfo | null => {
  if (station.songs.length === 0) return null
  station.currentIndex = (station.currentIndex - 1 + station.songs.length) % station.songs.length
  return station.songs[station.currentIndex]
}

/** 跳转到指定歌曲 */
export const jumpToSong = (station: RadioStation, songId: string): boolean => {
  const idx = station.songs.findIndex((s) => s.id === songId)
  if (idx < 0) return false
  station.currentIndex = idx
  return true
}

/** 删除电台 */
export const deleteStation = async (id: string): Promise<void> => {
  const all = await getAllStations()
  await saveData(STATIONS_KEY, all.filter((s) => s.id !== id))
}

/** 收藏/取消收藏电台 */
export const toggleFavorite = async (id: string): Promise<void> => {
  const all = await getAllStations()
  const station = all.find((s) => s.id === id)
  if (station) {
    station.favorite = !station.favorite
    await saveData(STATIONS_KEY, all)
  }
}

/** 记录播放历史 */
export const recordPlay = async (stationId: string, songId: string, skipped: boolean): Promise<void> => {
  const history = await getPlayHistory()
  history.unshift({ stationId, songId, playedAt: Date.now(), skipped })
  await saveData(HISTORY_KEY, history.slice(0, MAX_HISTORY))
}

/** 获取播放历史 */
export const getPlayHistory = async (): Promise<StationHistory[]> => {
  const data = await getData<StationHistory[]>(HISTORY_KEY)
  return data || []
}

/** 获取电台跳过率 */
export const getSkipRate = async (stationId: string): Promise<number> => {
  const history = await getPlayHistory()
  const stationHistory = history.filter((h) => h.stationId === stationId)
  if (stationHistory.length === 0) return 0
  const skipped = stationHistory.filter((h) => h.skipped).length
  return Math.round((skipped / stationHistory.length) * 100)
}

/** 基于歌手创建自定义电台 */
export const createArtistStation = (
  artist: string,
  pool: MusicInfo[],
  customName?: string,
): RadioStation | null => {
  const preset: StationPreset = {
    key: `artist_${artist}`,
    name: `${artist}电台`,
    type: 'artist',
    description: `基于${artist}的音乐品味推荐`,
    icon: '🎤',
    seedKeywords: [artist],
  }

  const matched = matchSongs(pool, [artist], 50)
  if (matched.length < 3) return null

  return {
    id: `radio_artist_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    preset,
    customName: customName || `${artist}电台`,
    songs: matched,
    currentIndex: 0,
    createdAt: Date.now(),
    playCount: 0,
    favorite: false,
    seeds: [],
  }
}

/** 获取所有预置电台 */
export const getPresets = (): StationPreset[] => STATION_PRESETS

/** 获取电台类型名 */
export const getStationTypeName = (type: StationType): string => {
  const map: Record<StationType, string> = {
    genre: '曲风',
    mood: '情绪',
    artist: '歌手',
    era: '年代',
    discovery: '探索',
    mix: '混合',
  }
  return map[type]
}

/** 获取电台统计 */
export const getStationStats = async (stationId: string): Promise<{
  totalPlays: number
  skipRate: number
  uniqueSongs: number
  favoriteArtists: string[]
}> => {
  const history = await getPlayHistory()
  const stationHistory = history.filter((h) => h.stationId === stationId)
  const played = stationHistory.filter((h) => !h.skipped)

  const stations = await getAllStations()
  const station = stations.find((s) => s.id === stationId)

  const artistMap = new Map<string, number>()
  for (const h of played) {
    const song = station?.songs.find((s) => s.id === h.songId)
    if (song) {
      artistMap.set(song.singer, (artistMap.get(song.singer) || 0) + 1)
    }
  }

  const favoriteArtists = Array.from(artistMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)

  return {
    totalPlays: stationHistory.length,
    skipRate: await getSkipRate(stationId),
    uniqueSongs: new Set(played.map((h) => h.songId)).size,
    favoriteArtists,
  }
}

/** 清空所有电台 */
export const clearAllStations = async (): Promise<void> => {
  await saveData(STATIONS_KEY, [])
  await saveData(HISTORY_KEY, [])
  addDevLog('info', 'SmartRadio', '所有电台已清空')
}