/**
 * 歌单混搭
 * 将多个歌单智能混搭，生成融合多种风格的新歌单
 */
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
import listState from '@/store/list/state'

type MusicInfo = LX.Music.MusicInfo

export type MashupStrategy =
  | 'alternate'    // 交替（A-B-A-B）
  | 'random'       // 随机
  | 'ratio'        // 按比例
  | 'bpm_sort'     // 按BPM排序
  | 'mood_flow'    // 情绪渐变
  | 'smart_blend'  // 智能融合

export interface MashupOptions {
  /** 各源歌单ID列表 */
  sourceListIds: string[]
  /** 混搭策略 */
  strategy: MashupStrategy
  /** 目标歌曲数量 */
  targetCount: number
  /** 各源比例（strategy=ratio 时生效） */
  ratios?: number[]
  /** 是否去重 */
  dedupe: boolean
  /** 是否过滤无效歌曲 */
  filterInvalid: boolean
  /** 新歌单名称 */
  name: string
}

export interface MashupResult {
  /** 生成的歌曲列表 */
  songs: MusicInfo[]
  /** 新歌单名 */
  name: string
  /** 来源分布 */
  sourceDistribution: Record<string, number>
  /** 实际策略 */
  strategy: MashupStrategy
  /** 生成时间 */
  timestamp: number
  /** 总歌曲数 */
  total: number
}

export interface SavedMashup {
  id: string
  result: MashupResult
  sourceListIds: string[]
  createdAt: number
}

const SAVED_KEY = '@playlist_mashup_v1'
const MAX_SAVED = 30

/** 获取歌单歌曲 */
const getSongsFromList = (listId: string): MusicInfo[] => {
  return listState.allMusicList.get(listId) || []
}

/** 主混搭入口 */
export const mashup = (options: MashupOptions): MashupResult => {
  const sources = options.sourceListIds
    .map((id) => getSongsFromList(id))
    .filter((s) => s.length > 0)

  if (sources.length === 0) {
    return createEmptyResult(options)
  }

  // 预处理：去重和过滤
  const processedSources = sources.map((songs) => preprocessSongs(songs, options))

  let result: MusicInfo[] = []
  switch (options.strategy) {
    case 'alternate':
      result = blendAlternate(processedSources, options.targetCount)
      break
    case 'random':
      result = blendRandom(processedSources, options.targetCount)
      break
    case 'ratio':
      result = blendByRatio(processedSources, options.targetCount, options.ratios || [])
      break
    case 'bpm_sort':
      result = blendByBpm(processedSources, options.targetCount)
      break
    case 'mood_flow':
      result = blendByMoodFlow(processedSources, options.targetCount)
      break
    case 'smart_blend':
    default:
      result = blendSmart(processedSources, options.targetCount)
      break
  }

  // 最终去重
  if (options.dedupe) {
    result = dedupeSongs(result)
  }

  // 统计来源分布
  const sourceDistribution: Record<string, number> = {}
  for (let i = 0; i < sources.length; i++) {
    sourceDistribution[`源${i + 1}`] = 0
  }
  for (const song of result) {
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].includes(song)) {
        sourceDistribution[`源${i + 1}`]++
        break
      }
    }
  }

  const mashupResult: MashupResult = {
    songs: result,
    name: options.name,
    sourceDistribution,
    strategy: options.strategy,
    timestamp: Date.now(),
    total: result.length,
  }

  addDevLog('info', 'PlaylistMashup', `生成歌单"${options.name}": ${result.length}首, 策略=${options.strategy}`)
  return mashupResult
}

const createEmptyResult = (options: MashupOptions): MashupResult => ({
  songs: [],
  name: options.name,
  sourceDistribution: {},
  strategy: options.strategy,
  timestamp: Date.now(),
  total: 0,
})

/** 预处理歌曲 */
const preprocessSongs = (songs: MusicInfo[], options: MashupOptions): MusicInfo[] => {
  let result = [...songs]
  if (options.filterInvalid) {
    result = result.filter((s) => s && s.id && s.name && s.singer)
  }
  if (options.dedupe) {
    result = dedupeSongs(result)
  }
  return result
}

/** 去重 */
const dedupeSongs = (songs: MusicInfo[]): MusicInfo[] => {
  const seen = new Set<string>()
  const result: MusicInfo[] = []
  for (const s of songs) {
    const key = `${s.singer}-${s.name}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(s)
    }
  }
  return result
}

/** 交替混搭 */
const blendAlternate = (sources: MusicInfo[][], target: number): MusicInfo[] => {
  const result: MusicInfo[] = []
  const indices = new Array(sources.length).fill(0)
  let exhausted = 0
  const exhaustedSet = new Set<number>()

  while (result.length < target && exhausted < sources.length) {
    for (let i = 0; i < sources.length; i++) {
      if (result.length >= target) break
      if (exhaustedSet.has(i)) continue
      if (indices[i] >= sources[i].length) {
        exhaustedSet.add(i)
        exhausted++
        continue
      }
      result.push(sources[i][indices[i]++])
    }
  }
  return result
}

/** 随机混搭 */
const blendRandom = (sources: MusicInfo[][], target: number): MusicInfo[] => {
  const all = sources.flat()
  const shuffled = shuffle(all)
  return shuffled.slice(0, target)
}

/** 按比例混搭 */
const blendByRatio = (sources: MusicInfo[][], target: number, ratios: number[]): MusicInfo[] => {
  if (ratios.length !== sources.length || ratios.reduce((a, b) => a + b, 0) === 0) {
    return blendAlternate(sources, target)
  }
  const total = ratios.reduce((a, b) => a + b, 0)
  const result: MusicInfo[] = []
  for (let i = 0; i < sources.length; i++) {
    const count = Math.floor((ratios[i] / total) * target)
    const shuffled = shuffle(sources[i])
    result.push(...shuffled.slice(0, count))
  }
  return shuffle(result).slice(0, target)
}

/** 按BPM排序混搭（伪BPM，基于歌曲名启发式） */
const blendByBpm = (sources: MusicInfo[][], target: number): MusicInfo[] => {
  const all = sources.flat()
  const withBpm = all.map((s) => ({ song: s, bpm: guessBpm(s) }))
  withBpm.sort((a, b) => a.bpm - b.bpm)
  return withBpm.slice(0, target).map((x) => x.song)
}

/** 情绪渐变混搭 */
const blendByMoodFlow = (sources: MusicInfo[][], target: number): MusicInfo[] => {
  const all = sources.flat()
  const withMood = all.map((s) => ({ song: s, mood: guessMood(s) }))
  // 从低能量到高能量再到低能量（U型曲线）
  withMood.sort((a, b) => a.mood - b.mood)
  const low = withMood.slice(0, Math.floor(target / 3))
  const high = withMood.slice(-Math.floor(target / 3))
  const mid = withMood.slice(Math.floor(target / 3), -Math.floor(target / 3) || undefined)
  const shuffledMid = shuffle(mid).slice(0, target - low.length - high.length)
  return [...low, ...shuffledMid, ...high.reverse()]
}

/** 智能融合 */
const blendSmart = (sources: MusicInfo[][], target: number): MusicInfo[] => {
  // 1. 交替取 60%
  const altCount = Math.floor(target * 0.6)
  const alternated = blendAlternate(sources, altCount)
  // 2. 随机取 40%
  const randCount = target - alternated.length
  const remaining = sources.flat().filter((s) => !alternated.includes(s))
  const randomized = shuffle(remaining).slice(0, randCount)
  return [...alternated, ...randomized]
}

/** 数组洗牌 */
const shuffle = <T>(arr: T[]): T[] => {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** 启发式猜测BPM */
const guessBpm = (song: MusicInfo): number => {
  const text = (song.name + song.singer).toLowerCase()
  if (/慢|slow|抒情|ballad|夜|moon/.test(text)) return 70
  if (/流行|pop/.test(text)) return 100
  if (/摇滚|rock|金属|metal/.test(text)) return 140
  if (/舞|dance|电子|dj|club/.test(text)) return 128
  if (/民谣|folk/.test(text)) return 85
  if (/说唱|rap|hip.?hop/.test(text)) return 95
  return 110
}

/** 启发式猜测情绪能量（0-100） */
const guessMood = (song: MusicInfo): number => {
  const text = (song.name + song.singer).toLowerCase()
  let score = 50
  if (/爱|love|心|甜/.test(text)) score += 10
  if (/悲|伤|哭|泪|sad/.test(text)) score -= 25
  if (/快乐|happy|欢/.test(text)) score += 25
  if (/摇滚|rock|金属|metal/.test(text)) score += 30
  if (/舞|dance|电子|dj/.test(text)) score += 20
  if (/慢|slow|夜|moon|静/.test(text)) score -= 20
  if (/愤怒|angry|恨/.test(text)) score += 35
  return Math.max(0, Math.min(100, score))
}

/** 保存混搭结果 */
export const saveMashup = async (result: MashupResult, sourceListIds: string[]): Promise<void> => {
  const all = await getSavedMashups()
  const saved: SavedMashup = {
    id: `mashup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    result,
    sourceListIds,
    createdAt: Date.now(),
  }
  all.unshift(saved)
  await saveData(SAVED_KEY, all.slice(0, MAX_SAVED))
  addDevLog('info', 'PlaylistMashup', `保存混搭: ${result.name}`)
}

/** 获取已保存的混搭 */
export const getSavedMashups = async (): Promise<SavedMashup[]> => {
  const data = await getData<SavedMashup[]>(SAVED_KEY)
  return data || []
}

/** 删除已保存的混搭 */
export const deleteSavedMashup = async (id: string): Promise<void> => {
  const all = await getSavedMashups()
  await saveData(SAVED_KEY, all.filter((m) => m.id !== id))
}

/** 获取可用源歌单列表（用户歌单+收藏+试听） */
export const getAvailableSourceLists = (): Array<{ id: string; name: string; count: number }> => {
  const result: Array<{ id: string; name: string; count: number }> = []
  for (const list of listState.allList) {
    const songs = listState.allMusicList.get(list.id) || []
    result.push({ id: list.id, name: list.name, count: songs.length })
  }
  return result.filter((l) => l.count > 0)
}

/** 获取策略说明 */
export const getStrategyDescription = (strategy: MashupStrategy): string => {
  const map: Record<MashupStrategy, string> = {
    alternate: '交替模式：从各歌单轮流取歌，均匀分布',
    random: '随机模式：将所有歌曲打乱随机选取',
    ratio: '比例模式：按指定比例从各歌单取歌',
    bpm_sort: 'BPM模式：按节奏从慢到快排序',
    mood_flow: '情绪渐变：低能量→高能量→低能量的U型曲线',
    smart_blend: '智能融合：60%交替+40%随机的最佳组合',
  }
  return map[strategy]
}

/** 获取所有策略 */
export const getAllStrategies = (): Array<{ key: MashupStrategy; name: string; desc: string }> => [
  { key: 'smart_blend', name: '智能融合', desc: '60%交替+40%随机' },
  { key: 'alternate', name: '交替模式', desc: '轮流取歌均匀分布' },
  { key: 'random', name: '随机模式', desc: '全部打乱随机选取' },
  { key: 'ratio', name: '比例模式', desc: '按指定比例分配' },
  { key: 'bpm_sort', name: 'BPM排序', desc: '按节奏从慢到快' },
  { key: 'mood_flow', name: '情绪渐变', desc: 'U型能量曲线' },
]
