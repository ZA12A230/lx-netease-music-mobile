/**
 * 音乐地图模块
 * 基于位置的音乐记忆，记录在何处听了什么歌
 */
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export interface LocationPoint {
  /** 纬度 */
  latitude: number
  /** 经度 */
  longitude: number
  /** 地名 */
  name?: string
  /** 详细地址 */
  address?: string
}

export interface MusicMemory {
  id: string
  musicInfo: {
    id: string | null
    name: string
    singer: string
    pic?: string | null
    source?: string
  }
  location: LocationPoint
  timestamp: number
  /** 备注 */
  note?: string
  /** 心情 */
  mood?: string
  /** 播放时长（秒） */
  playDuration: number
}

export interface LocationCluster {
  center: LocationPoint
  radius: number // 米
  memories: MusicMemory[]
  topSongs: Array<{ name: string; singer: string; count: number }>
  topMoods: Array<{ mood: string; count: number }>
  totalPlays: number
  totalDuration: number
}

const STORAGE_KEY = '@music_map_v1'
const MAX_MEMORIES = 5000

/** 添加音乐记忆 */
export const addMusicMemory = async (
  musicInfo: MusicInfo,
  location: LocationPoint,
  playDuration: number,
  mood?: string,
  note?: string,
): Promise<string> => {
  const all = await getAllMemories()
  const id = `memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const memory: MusicMemory = {
    id,
    musicInfo: {
      id: musicInfo.id,
      name: musicInfo.name,
      singer: musicInfo.singer,
      pic: musicInfo.meta?.picUrl ?? null,
      source: (musicInfo as any).source,
    },
    location,
    timestamp: Date.now(),
    note,
    mood,
    playDuration,
  }

  all.unshift(memory)
  if (all.length > MAX_MEMORIES) all.length = MAX_MEMORIES

  await saveData(STORAGE_KEY, all)
  addDevLog('info', 'MusicMap', `添加音乐记忆: ${musicInfo.name} @ ${location.name || '未知位置'}`)
  return id
}

/** 获取所有记忆 */
export const getAllMemories = async (): Promise<MusicMemory[]> => {
  const data = await getData<MusicMemory[]>(STORAGE_KEY)
  return data || []
}

/** 获取指定位置附近的记忆 */
export const getMemoriesNearby = async (location: LocationPoint, radiusMeters = 500): Promise<MusicMemory[]> => {
  const all = await getAllMemories()
  return all.filter((m) => {
    const distance = calculateDistance(location, m.location)
    return distance <= radiusMeters
  })
}

/** 获取指定时间范围内的记忆 */
export const getMemoriesByTimeRange = async (start: number, end: number): Promise<MusicMemory[]> => {
  const all = await getAllMemories()
  return all.filter((m) => m.timestamp >= start && m.timestamp <= end)
}

/** 计算两点距离（Haversine公式） */
export const calculateDistance = (a: LocationPoint, b: LocationPoint): number => {
  const R = 6371000 // 地球半径（米）
  const lat1Rad = a.latitude * Math.PI / 180
  const lat2Rad = b.latitude * Math.PI / 180
  const deltaLat = (b.latitude - a.latitude) * Math.PI / 180
  const deltaLon = (b.longitude - a.longitude) * Math.PI / 180

  const sinDeltaLat = Math.sin(deltaLat / 2)
  const sinDeltaLon = Math.sin(deltaLon / 2)
  const aHav = sinDeltaLat * sinDeltaLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinDeltaLon * sinDeltaLon
  const c = 2 * Math.atan2(Math.sqrt(aHav), Math.sqrt(1 - aHav))
  return R * c
}

/** 聚类分析：将附近的记忆合并 */
export const clusterMemories = async (clusterRadius = 200): Promise<LocationCluster[]> => {
  const all = await getAllMemories()
  if (all.length === 0) return []

  const clusters: LocationCluster[] = []
  const assigned = new Set<string>()

  for (const memory of all) {
    if (assigned.has(memory.id)) continue

    // 找到附近所有记忆
    const nearby = all.filter((m) => !assigned.has(m.id) && calculateDistance(memory.location, m.location) <= clusterRadius)

    // 标记已分配
    for (const m of nearby) assigned.add(m.id)

    // 计算中心点
    const centerLat = nearby.reduce((sum, m) => sum + m.location.latitude, 0) / nearby.length
    const centerLon = nearby.reduce((sum, m) => sum + m.location.longitude, 0) / nearby.length

    // 统计歌曲
    const songMap = new Map<string, { name: string; singer: string; count: number }>()
    const moodMap = new Map<string, number>()
    let totalDuration = 0

    for (const m of nearby) {
      const songKey = `${m.musicInfo.name}_${m.musicInfo.singer}`
      if (songMap.has(songKey)) {
        songMap.get(songKey)!.count++
      } else {
        songMap.set(songKey, { name: m.musicInfo.name, singer: m.musicInfo.singer, count: 1 })
      }
      if (m.mood) {
        moodMap.set(m.mood, (moodMap.get(m.mood) || 0) + 1)
      }
      totalDuration += m.playDuration
    }

    // 中心点地名
    const centerName = nearby[0].location.name || '未知位置'

    clusters.push({
      center: { latitude: centerLat, longitude: centerLon, name: centerName },
      radius: clusterRadius,
      memories: nearby,
      topSongs: Array.from(songMap.values()).sort((a, b) => b.count - a.count).slice(0, 5),
      topMoods: Array.from(moodMap.entries())
        .map(([mood, count]) => ({ mood, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      totalPlays: nearby.length,
      totalDuration,
    })
  }

  // 按记忆数量排序
  return clusters.sort((a, b) => b.totalPlays - a.totalPlays)
}

/** 删除音乐记忆 */
export const deleteMemory = async (id: string): Promise<void> => {
  const all = await getAllMemories()
  const filtered = all.filter((m) => m.id !== id)
  await saveData(STORAGE_KEY, filtered)
}

/** 更新记忆备注 */
export const updateMemoryNote = async (id: string, note: string): Promise<void> => {
  const all = await getAllMemories()
  const idx = all.findIndex((m) => m.id === id)
  if (idx >= 0) {
    all[idx].note = note
    await saveData(STORAGE_KEY, all)
  }
}

/** 获取统计信息 */
export const getMapStats = async (): Promise<{
  totalMemories: number
  uniqueLocations: number
  uniqueSongs: number
  totalDuration: number
  topLocations: Array<{ name: string; count: number }>
}> => {
  const all = await getAllMemories()
  const locationSet = new Set<string>()
  const songSet = new Set<string>()
  const locationMap = new Map<string, number>()
  let totalDuration = 0

  for (const m of all) {
    const locKey = `${m.location.latitude.toFixed(4)},${m.location.longitude.toFixed(4)}`
    locationSet.add(locKey)
    songSet.add(`${m.musicInfo.name}_${m.musicInfo.singer}`)
    totalDuration += m.playDuration

    const locName = m.location.name || locKey
    locationMap.set(locName, (locationMap.get(locName) || 0) + 1)
  }

  return {
    totalMemories: all.length,
    uniqueLocations: locationSet.size,
    uniqueSongs: songSet.size,
    totalDuration,
    topLocations: Array.from(locationMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  }
}

/** 时光机：获取某天的音乐记忆 */
export const getTimeMachineMemories = async (date: Date): Promise<MusicMemory[]> => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return getMemoriesByTimeRange(start.getTime(), end.getTime())
}

/** 清空所有记忆 */
export const clearAllMemories = async (): Promise<void> => {
  await saveData(STORAGE_KEY, [])
  addDevLog('info', 'MusicMap', '所有音乐记忆已清空')
}
