/**
 * 音乐相似度推荐模块
 * 基于歌曲特征（歌手、流派、年代、BPM、能量）计算相似度并推荐
 */
import listState from '@/store/list/state'
import { getPlayHistoryByRange } from '@/core/player/playHistory'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export interface SongFeatures {
  artist: string
  /** 流派（基于歌手/歌名推断） */
  genre: string
  /** 年代（基于歌名/专辑推断） */
  era: string
  /** BPM 估算 */
  bpm: number
  /** 能量值 0-1 */
  energy: number
  /** 舞蹈性 0-1 */
  danceability: number
  /** 心情 */
  mood: string
}

export interface SimilarityResult {
  song: MusicInfo
  score: number // 0-100
  reasons: string[]
}

const GENRE_KEYWORDS: Record<string, string[]> = {
  pop: ['pop', '流行', '流行曲', '舞曲'],
  rock: ['rock', '摇滚', '金属', 'metal', 'punk', '朋克'],
  classical: ['classical', '古典', '钢琴', 'piano', '交响'],
  jazz: ['jazz', '爵士', '蓝调', 'blues'],
  electronic: ['edm', 'electronic', '电子', 'dj', 'house', 'techno'],
  hiphop: ['hip', 'hop', 'rap', '说唱', '嘻哈'],
  folk: ['folk', '民谣', '乡村', 'country'],
  rnb: ['r&b', 'rnb', '节奏布鲁斯'],
  soundtrack: ['ost', '原声', 'soundtrack', '主题曲', '插曲'],
}

const ERA_KEYWORDS: Record<string, string[]> = {
  '80s': ['80', '八十', '198'],
  '90s': ['90', '九十', '199'],
  '00s': ['2000', '2001', '2002', '2003', '2004', '2005'],
  '10s': ['2010', '2011', '2012', '2013', '2014', '2015'],
  '20s': ['2020', '2021', '2022', '2023', '2024'],
}

/** 推断流派 */
const inferGenre = (name: string, singer: string): string => {
  const text = (name + ' ' + singer).toLowerCase()
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return genre
  }
  return 'pop' // 默认流行
}

/** 推断年代 */
const inferEra = (name: string, album: string): string => {
  const text = (name + ' ' + album).toLowerCase()
  for (const [era, keywords] of Object.entries(ERA_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return era
  }
  return 'modern'
}

/** 估算BPM */
const estimateBPM = (genre: string, name: string): number => {
  const text = name.toLowerCase()
  if (/慢歌|slow|抒情|ballad/.test(text)) return 70
  if (/舞|dance|club|派对|party/.test(text)) return 128
  switch (genre) {
    case 'rock': return 140
    case 'electronic': return 128
    case 'pop': return 110
    case 'hiphop': return 95
    case 'classical': return 80
    case 'jazz': return 100
    case 'folk': return 90
    case 'rnb': return 95
    default: return 110
  }
}

/** 估算能量值 */
const estimateEnergy = (name: string, genre: string): number => {
  const text = name.toLowerCase()
  if (/燃|热血|战斗|fight|power|激情|hot/.test(text)) return 0.9
  if (/安静|silent|宁静|sleep|sleep|夜|moon/.test(text)) return 0.2
  const baseEnergy: Record<string, number> = {
    rock: 0.85, electronic: 0.85, pop: 0.6, hiphop: 0.7,
    classical: 0.3, jazz: 0.4, folk: 0.4, rnb: 0.5, soundtrack: 0.4,
  }
  return baseEnergy[genre] ?? 0.5
}

/** 估算舞蹈性 */
const estimateDanceability = (genre: string, bpm: number): number => {
  const baseDance: Record<string, number> = {
    electronic: 0.9, pop: 0.7, hiphop: 0.75, rnb: 0.7,
    rock: 0.5, jazz: 0.4, folk: 0.3, classical: 0.15, soundtrack: 0.3,
  }
  let dance = baseDance[genre] ?? 0.5
  // BPM 在 100-130 之间舞蹈性最强
  if (bpm >= 100 && bpm <= 130) dance += 0.1
  else if (bpm < 80 || bpm > 150) dance -= 0.2
  return Math.max(0, Math.min(1, dance))
}

/** 提取歌曲特征 */
export const extractFeatures = (song: MusicInfo): SongFeatures => {
  const genre = inferGenre(song.name, song.singer)
  // album 在 meta.albumName 中，但访问需要类型保护，简化处理
  const album = (song as any).meta?.albumName || (song as any).album || ''
  const era = inferEra(song.name, album)
  const bpm = estimateBPM(genre, song.name)
  const energy = estimateEnergy(song.name, genre)
  const danceability = estimateDanceability(genre, bpm)
  const mood = inferMoodFromName(song.name)

  return { artist: song.singer, genre, era, bpm, energy, danceability, mood }
}

const inferMoodFromName = (name: string): string => {
  const text = name.toLowerCase()
  if (/快乐|阳光|happy|sunshine|晴天/.test(text)) return 'happy'
  if (/伤心|泪|sad|cry|孤独|lonely/.test(text)) return 'sad'
  if (/燃|热血|fight|power|战斗/.test(text)) return 'energetic'
  if (/夜|moon|安静|宁静|sleep/.test(text)) return 'calm'
  if (/爱|love|心|heart|浪漫/.test(text)) return 'romantic'
  return 'neutral'
}

/** 计算两首歌的相似度 */
export const calculateSimilarity = (a: SongFeatures, b: SongFeatures): { score: number; reasons: string[] } => {
  let score = 0
  const reasons: string[] = []

  // 同歌手 +30
  if (a.artist === b.artist && a.artist) {
    score += 30
    reasons.push(`同歌手: ${a.artist}`)
  }

  // 同流派 +25
  if (a.genre === b.genre) {
    score += 25
    reasons.push(`同流派: ${a.genre}`)
  }

  // 同年代 +15
  if (a.era === b.era) {
    score += 15
    reasons.push(`同年代: ${a.era}`)
  }

  // BPM 相近 +20
  const bpmDiff = Math.abs(a.bpm - b.bpm)
  if (bpmDiff <= 10) {
    score += 20
    reasons.push('节奏相近')
  } else if (bpmDiff <= 20) {
    score += 10
  }

  // 能量相近 +15
  const energyDiff = Math.abs(a.energy - b.energy)
  if (energyDiff <= 0.2) {
    score += 15
    reasons.push('能量相近')
  } else if (energyDiff <= 0.4) {
    score += 7
  }

  // 舞蹈性相近 +10
  if (Math.abs(a.danceability - b.danceability) <= 0.2) {
    score += 10
  }

  // 同心情 +15
  if (a.mood === b.mood && a.mood !== 'neutral') {
    score += 15
    reasons.push(`同心情: ${a.mood}`)
  }

  return { score: Math.min(100, score), reasons }
}

/** 获取相似歌曲推荐 */
export const getSimilarSongs = async (target: MusicInfo, limit = 20): Promise<SimilarityResult[]> => {
  const targetFeatures = extractFeatures(target)
  const candidates: MusicInfo[] = []

  // 从所有列表中收集候选歌曲
  for (const list of listState.allList) {
    const songs = (list as any).list || []
    for (const s of songs) {
      if (s.id !== target.id) candidates.push(s)
    }
  }

  if (candidates.length === 0) {
    addDevLog('warn', 'Similarity', '没有候选歌曲')
    return []
  }

  // 计算相似度
  const results: SimilarityResult[] = candidates.map((song) => {
    const features = extractFeatures(song)
    const { score, reasons } = calculateSimilarity(targetFeatures, features)
    return { song, score, reasons }
  })

  // 排序并返回 Top N
  results.sort((a, b) => b.score - a.score)
  addDevLog('info', 'Similarity', `为《${target.name}》找到${results.length}首相似歌曲`)
  return results.slice(0, limit)
}

/** 基于听歌历史推荐相似歌曲 */
export const recommendFromHistory = async (days = 7, limit = 30): Promise<SimilarityResult[]> => {
  const now = Date.now()
  const startTime = now - days * 24 * 60 * 60 * 1000
  const history = await getPlayHistoryByRange(startTime, now)

  if (history.length === 0) return []

  // 取最近听过的歌曲作为种子
  const seeds = history.slice(0, 10).map((h) => h.musicInfo)
  const allResults: SimilarityResult[] = []
  const seenIds = new Set<string>()

  for (const seed of seeds) {
    if (!seed || seenIds.has(seed.id as string)) continue
    seenIds.add(seed.id as string)
    const similar = await getSimilarSongs(seed, 5)
    allResults.push(...similar)
  }

  // 去重并按分数排序
  const uniqueMap = new Map<string, SimilarityResult>()
  for (const r of allResults) {
    const id = r.song.id as string
    if (!uniqueMap.has(id) || uniqueMap.get(id)!.score < r.score) {
      uniqueMap.set(id, r)
    }
  }

  return Array.from(uniqueMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
