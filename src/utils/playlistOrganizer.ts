/**
 * 智能歌单分类整理
 * 自动分析歌单并按规则分类整理
 */
import listState from '@/store/list/state'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export type OrganizeRule =
  | 'artist'      // 按歌手分组
  | 'source'      // 按音源分组
  | 'alphabet'    // 按字母排序
  | 'playCount'   // 按播放次数
  | 'addTime'     // 按添加时间
  | 'duration'    // 按时长
  | 'mood'        // 按情绪
  | 'era'         // 按年代

export interface OrganizeResult {
  groups: Array<{
    name: string
    songs: MusicInfo[]
    count: number
  }>
  totalSongs: number
  rule: OrganizeRule
}

/** 按规则整理歌单 */
export const organizePlaylist = (listId: string, rule: OrganizeRule): OrganizeResult => {
  const list = listState.allList.find((l) => l.id === listId)
  if (!list) {
    return { groups: [], totalSongs: 0, rule }
  }

  const songs = [...list.list]
  const groups: OrganizeResult['groups'] = []

  switch (rule) {
    case 'artist': {
      const artistMap = new Map<string, MusicInfo[]>()
      for (const song of songs) {
        const artist = song.singer || '未知歌手'
        if (!artistMap.has(artist)) artistMap.set(artist, [])
        artistMap.get(artist)!.push(song)
      }
      for (const [artist, artistSongs] of artistMap) {
        groups.push({ name: artist, songs: artistSongs, count: artistSongs.length })
      }
      groups.sort((a, b) => b.count - a.count)
      break
    }
    case 'source': {
      const sourceMap = new Map<string, MusicInfo[]>()
      for (const song of songs) {
        const source = (song as any).source || '未知'
        const sourceName = getSourceName(source)
        if (!sourceMap.has(sourceName)) sourceMap.set(sourceName, [])
        sourceMap.get(sourceName)!.push(song)
      }
      for (const [source, sourceSongs] of sourceMap) {
        groups.push({ name: source, songs: sourceSongs, count: sourceSongs.length })
      }
      groups.sort((a, b) => b.count - a.count)
      break
    }
    case 'alphabet': {
      const alphaMap = new Map<string, MusicInfo[]>()
      for (const song of songs) {
        const firstChar = song.name.charAt(0).toUpperCase()
        const key = /[A-Z]/.test(firstChar) ? firstChar : '#'
        if (!alphaMap.has(key)) alphaMap.set(key, [])
        alphaMap.get(key)!.push(song)
      }
      for (const [letter, letterSongs] of alphaMap) {
        letterSongs.sort((a, b) => a.name.localeCompare(b.name))
        groups.push({ name: letter, songs: letterSongs, count: letterSongs.length })
      }
      groups.sort((a, b) => a.name.localeCompare(b.name))
      break
    }
    case 'duration': {
      const durationGroups = [
        { name: '短曲 (<3分钟)', min: 0, max: 180 },
        { name: '标准 (3-5分钟)', min: 180, max: 300 },
        { name: '长曲 (5-10分钟)', min: 300, max: 600 },
        { name: '超长 (>10分钟)', min: 600, max: Infinity },
      ]
      for (const g of durationGroups) {
        const gSongs = songs.filter((s) => {
          const seconds = parseIntervalToSeconds(s.interval)
          return seconds >= g.min && seconds < g.max
        })
        if (gSongs.length > 0) groups.push({ name: g.name, songs: gSongs, count: gSongs.length })
      }
      break
    }
    case 'era': {
      const eraMap = new Map<string, MusicInfo[]>()
      for (const song of songs) {
        const era = inferEra(song.name, (song as any).meta?.albumName || '')
        if (!eraMap.has(era)) eraMap.set(era, [])
        eraMap.get(era)!.push(song)
      }
      for (const [era, eraSongs] of eraMap) {
        groups.push({ name: era, songs: eraSongs, count: eraSongs.length })
      }
      groups.sort((a, b) => a.name.localeCompare(b.name))
      break
    }
    case 'mood': {
      const moodMap = new Map<string, MusicInfo[]>()
      for (const song of songs) {
        const mood = inferMood(song.name)
        if (!moodMap.has(mood)) moodMap.set(mood, [])
        moodMap.get(mood)!.push(song)
      }
      for (const [mood, moodSongs] of moodMap) {
        groups.push({ name: mood, songs: moodSongs, count: moodSongs.length })
      }
      groups.sort((a, b) => b.count - a.count)
      break
    }
    case 'addTime':
    case 'playCount':
    default:
      groups.push({ name: '全部歌曲', songs, count: songs.length })
      break
  }

  addDevLog('info', 'PlaylistOrganizer', `按 ${rule} 整理歌单，共${groups.length}组`)
  return { groups, totalSongs: songs.length, rule }
}

const getSourceName = (source: string): string => {
  const names: Record<string, string> = {
    wy: '网易云',
    kg: '酷狗',
    kw: '酷我',
    tx: 'QQ音乐',
    mg: '咪咕',
    local: '本地',
  }
  return names[source] || source
}

const parseIntervalToSeconds = (interval: string | null | undefined): number => {
  if (!interval) return 0
  const parts = interval.split(':')
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  }
  return 0
}

const inferEra = (name: string, album: string): string => {
  const text = (name + album).toLowerCase()
  if (/怀旧|经典|老歌|岁月|80|90年代|retro|classic/.test(text)) return '怀旧经典'
  if (/新|new|2024|2025|2026|最新/.test(text)) return '新时代'
  if (/民谣|folk|草原|故乡/.test(text)) return '民谣风'
  if (/摇滚|rock|金属|metal|punk/.test(text)) return '摇滚'
  if (/电子|electronic|dj|舞曲|dance/.test(text)) return '电子舞曲'
  return '其他'
}

const inferMood = (name: string): string => {
  if (/爱|love|心|heart|浪漫|情/.test(name)) return '浪漫情歌'
  if (/夜|moon|night|夜晚|月|孤独|寂寞/.test(name)) return '深夜思绪'
  if (/快乐|happy|阳光|sun|开心/.test(name)) return '欢快阳光'
  if (/悲伤|sad|泪|哭|心碎|伤/.test(name)) return '悲伤抒情'
  if (/摇滚|rock|metal|金属|热血|燃烧/.test(name)) return '热血激昂'
  return '其他'
}

/** 检测重复歌曲 */
export const detectDuplicates = (listId: string): Array<{ name: string; singer: string; count: number }> => {
  const list = listState.allList.find((l) => l.id === listId)
  if (!list) return []

  const songMap = new Map<string, number>()
  for (const song of list.list) {
    const key = `${song.name}_${song.singer}`
    songMap.set(key, (songMap.get(key) || 0) + 1)
  }

  const duplicates: Array<{ name: string; singer: string; count: number }> = []
  for (const [key, count] of songMap) {
    if (count > 1) {
      const [name, singer] = key.split('_')
      duplicates.push({ name, singer, count })
    }
  }

  return duplicates.sort((a, b) => b.count - a.count)
}

/** 检测失效歌曲 */
export const detectInvalidSongs = (listId: string): MusicInfo[] => {
  const list = listState.allList.find((l) => l.id === listId)
  if (!list) return []

  return list.list.filter((song) => {
    // 简化判断：本地歌曲检查文件路径
    if ((song as any).source === 'local') {
      return !(song as any).meta?.filePath
    }
    return false
  })
}

/** 生成歌单摘要报告 */
export const generatePlaylistReport = (listId: string): string => {
  const list = listState.allList.find((l) => l.id === listId)
  if (!list) return '歌单不存在'

  const songs = list.list
  const totalDuration = songs.reduce((sum, s) => sum + parseIntervalToSeconds(s.interval), 0)
  const artistSet = new Set(songs.map((s) => s.singer))
  const sourceSet = new Set(songs.map((s) => (s as any).source))

  const hours = Math.floor(totalDuration / 3600)
  const minutes = Math.floor((totalDuration % 3600) / 60)

  return `📊 歌单报告: ${list.name}
🎵 歌曲总数: ${songs.length}
🎤 歌手数量: ${artistSet.size}
📡 音源数量: ${sourceSet.size}
⏱️ 总时长: ${hours}小时${minutes}分钟
🎯 平均时长: ${Math.floor(totalDuration / Math.max(songs.length, 1) / 60)}分钟`
}
