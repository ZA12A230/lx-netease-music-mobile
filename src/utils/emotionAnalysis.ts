/**
 * 歌曲情绪AI分析
 * AI分析歌曲的情绪、能量、氛围
 */
import { chat } from '@/core/ai'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export type EmotionCategory =
  | 'happy'       // 快乐
  | 'sad'         // 悲伤
  | 'energetic'   // 充满活力
  | 'calm'        // 平静
  | 'romantic'    // 浪漫
  | 'angry'       // 愤怒
  | 'nostalgic'   // 怀旧
  | 'mysterious'  // 神秘
  | 'hopeful'     // 充满希望
  | 'melancholic' // 忧郁

export interface EmotionAnalysis {
  songId: string
  songName: string
  singer: string
  emotions: Array<{
    category: EmotionCategory
    score: number // 0-1
  }>
  dominantEmotion: EmotionCategory
  energy: number // 0-1
  valence: number // 0-1 (负面→正面)
  danceability: number // 0-1
  acousticness: number // 0-1
  tempo: number // BPM估算
  description: string
  tags: string[]
  timestamp: number
}

const CACHE_KEY = '@emotion_analysis_v1'

const EMOTION_LABELS: Record<EmotionCategory, { name: string; icon: string; color: string }> = {
  happy: { name: '快乐', icon: '😊', color: '#FFD700' },
  sad: { name: '悲伤', icon: '😢', color: '#4682B4' },
  energetic: { name: '活力', icon: '⚡', color: '#FF4500' },
  calm: { name: '平静', icon: '🌊', color: '#87CEEB' },
  romantic: { name: '浪漫', icon: '❤️', color: '#FF69B4' },
  angry: { name: '愤怒', icon: '🔥', color: '#DC143C' },
  nostalgic: { name: '怀旧', icon: '📼', color: '#DAA520' },
  mysterious: { name: '神秘', icon: '🌙', color: '#9370DB' },
  hopeful: { name: '希望', icon: '🌟', color: '#00FA9A' },
  melancholic: { name: '忧郁', icon: '🌧️', color: '#708090' },
}

/** 分析歌曲情绪 */
export const analyzeSongEmotion = async (song: MusicInfo): Promise<EmotionAnalysis | null> => {
  // 检查缓存
  const cache = await getCache()
  if (cache[song.id] && Date.now() - cache[song.id].timestamp < 30 * 24 * 60 * 60 * 1000) {
    return cache[song.id]
  }

  try {
    const prompt = `分析歌曲《${song.name}》- ${song.singer} 的情绪特征。请基于歌名、歌手和常识进行推测，以JSON格式返回:
{
  "emotions": [{"category": "happy|sad|energetic|calm|romantic|angry|nostalgic|mysterious|hopeful|melancholic", "score": 0.0-1.0}],
  "energy": 0.0-1.0,
  "valence": 0.0-1.0,
  "danceability": 0.0-1.0,
  "acousticness": 0.0-1.0,
  "tempo": BPM数值,
  "description": "情绪描述",
  "tags": ["标签1", "标签2"]
}`

    const result = await chat(prompt, [])
    if (!result) {
      // 降级：使用规则推断
      return inferEmotionFromRules(song)
    }

    let parsed: any
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      return inferEmotionFromRules(song)
    }

    if (!parsed) return inferEmotionFromRules(song)

    const emotions = (parsed.emotions || []).map((e: any) => ({
      category: e.category as EmotionCategory,
      score: Math.max(0, Math.min(1, e.score || 0)),
    })).sort((a: any, b: any) => b.score - a.score)

    const analysis: EmotionAnalysis = {
      songId: song.id,
      songName: song.name,
      singer: song.singer,
      emotions,
      dominantEmotion: emotions[0]?.category || 'calm',
      energy: parsed.energy || 0.5,
      valence: parsed.valence || 0.5,
      danceability: parsed.danceability || 0.5,
      acousticness: parsed.acousticness || 0.5,
      tempo: parsed.tempo || 120,
      description: parsed.description || '',
      tags: parsed.tags || [],
      timestamp: Date.now(),
    }

    // 保存到缓存
    cache[song.id] = analysis
    await saveData(CACHE_KEY, cache)

    addDevLog('info', 'EmotionAnalysis', `分析歌曲情绪: ${song.name}`)
    return analysis
  } catch (e: any) {
    addDevLog('error', 'EmotionAnalysis', `分析失败: ${e?.message}`)
    return inferEmotionFromRules(song)
  }
}

/** 基于规则推断情绪（降级方案） */
const inferEmotionFromRules = (song: MusicInfo): EmotionAnalysis => {
  const text = (song.name + song.singer).toLowerCase()
  const emotions: Array<{ category: EmotionCategory; score: number }> = []
  let dominantEmotion: EmotionCategory = 'calm'
  let energy = 0.5
  let valence = 0.5

  if (/快乐|开心|阳光|happy|sun/.test(text)) {
    emotions.push({ category: 'happy', score: 0.8 })
    dominantEmotion = 'happy'
    valence = 0.9
  }
  if (/悲伤|泪|伤心|sad|cry|心碎/.test(text)) {
    emotions.push({ category: 'sad', score: 0.8 })
    dominantEmotion = 'sad'
    valence = 0.2
    energy = 0.3
  }
  if (/爱|情|心|love|heart|浪漫/.test(text)) {
    emotions.push({ category: 'romantic', score: 0.7 })
    if (emotions.length === 1) dominantEmotion = 'romantic'
    valence = 0.7
  }
  if (/摇滚|rock|metal|punk|热血|燃烧|战斗/.test(text)) {
    emotions.push({ category: 'energetic', score: 0.8 })
    if (emotions.length === 1) dominantEmotion = 'energetic'
    energy = 0.9
  }
  if (/夜|moon|静|calm|宁静|安详/.test(text)) {
    emotions.push({ category: 'calm', score: 0.7 })
    if (emotions.length === 1) dominantEmotion = 'calm'
    energy = 0.3
  }
  if (/怀旧|岁月|曾经|回忆|retro|classic/.test(text)) {
    emotions.push({ category: 'nostalgic', score: 0.7 })
    if (emotions.length === 1) dominantEmotion = 'nostalgic'
  }
  if (/愤怒|anger|fire|战/.test(text)) {
    emotions.push({ category: 'angry', score: 0.7 })
    if (emotions.length === 1) dominantEmotion = 'angry'
    energy = 0.9
    valence = 0.3
  }

  if (emotions.length === 0) {
    emotions.push({ category: 'calm', score: 0.5 })
  }

  emotions.sort((a, b) => b.score - a.score)

  return {
    songId: song.id,
    songName: song.name,
    singer: song.singer,
    emotions,
    dominantEmotion,
    energy,
    valence,
    danceability: energy * 0.8,
    acousticness: 1 - energy,
    tempo: energy > 0.7 ? 140 : energy > 0.4 ? 110 : 80,
    description: `基于歌曲名推断，主导情绪为${EMOTION_LABELS[dominantEmotion].name}`,
    tags: [EMOTION_LABELS[dominantEmotion].name],
    timestamp: Date.now(),
  }
}

/** 获取情绪标签信息 */
export const getEmotionLabel = (emotion: EmotionCategory) => EMOTION_LABELS[emotion]

/** 获取所有情绪标签 */
export const getAllEmotionLabels = () => EMOTION_LABELS

/** 批量分析歌曲 */
export const analyzeSongsBatch = async (songs: MusicInfo[]): Promise<EmotionAnalysis[]> => {
  const results: EmotionAnalysis[] = []
  for (const song of songs) {
    const analysis = await analyzeSongEmotion(song)
    if (analysis) results.push(analysis)
  }
  return results
}

/** 根据情绪筛选歌曲 */
export const filterByEmotion = async (
  songs: MusicInfo[],
  targetEmotion: EmotionCategory,
  minScore = 0.5,
): Promise<Array<{ song: MusicInfo; analysis: EmotionAnalysis }>> => {
  const results: Array<{ song: MusicInfo; analysis: EmotionAnalysis }> = []
  const cache = await getCache()

  for (const song of songs) {
    let analysis = cache[song.id]
    if (!analysis) {
      analysis = await analyzeSongEmotion(song)
    }
    if (analysis) {
      const emotion = analysis.emotions.find((e) => e.category === targetEmotion)
      if (emotion && emotion.score >= minScore) {
        results.push({ song, analysis })
      }
    }
  }

  results.sort((a, b) => {
    const aScore = a.analysis.emotions.find((e) => e.category === targetEmotion)?.score || 0
    const bScore = b.analysis.emotions.find((e) => e.category === targetEmotion)?.score || 0
    return bScore - aScore
  })

  return results
}

/** 生成情绪雷达图数据 */
export const generateEmotionRadar = (analyses: EmotionAnalysis[]): Record<EmotionCategory, number> => {
  const radar: Record<EmotionCategory, number> = {
    happy: 0, sad: 0, energetic: 0, calm: 0, romantic: 0,
    angry: 0, nostalgic: 0, mysterious: 0, hopeful: 0, melancholic: 0,
  }

  for (const analysis of analyses) {
    for (const emotion of analysis.emotions) {
      radar[emotion.category] += emotion.score
    }
  }

  // 归一化
  const max = Math.max(...Object.values(radar), 1)
  for (const key of Object.keys(radar) as EmotionCategory[]) {
    radar[key] = radar[key] / max
  }

  return radar
}

const getCache = async (): Promise<Record<string, EmotionAnalysis>> => {
  const data = await getData<Record<string, EmotionAnalysis>>(CACHE_KEY)
  return data || {}
}

/** 清空分析缓存 */
export const clearAnalysisCache = async (): Promise<void> => {
  await saveData(CACHE_KEY, {})
  addDevLog('info', 'EmotionAnalysis', '情绪分析缓存已清空')
}
