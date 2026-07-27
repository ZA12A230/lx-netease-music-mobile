/**
 * 智能心情推荐模块
 * 根据听歌历史、时间、季节自动分析并推荐符合心情的音乐
 */
import { getPlayHistoryByRange } from '@/core/player/playHistory'
type MusicInfo = LX.Music.MusicInfo

export type Mood = 'happy' | 'sad' | 'energetic' | 'calm' | 'romantic' | 'focus' | 'party'

export interface MoodAnalysis {
  mood: Mood
  confidence: number
  reason: string
  topGenres: string[]
  topArtists: string[]
  averageTempo: 'slow' | 'medium' | 'fast'
}

export interface MoodRecommendResult {
  analysis: MoodAnalysis
  recommendations: MusicInfo[]
}

/** 心情元数据 */
const MOOD_META: Record<Mood, { name: string; emoji: string; color: string; desc: string }> = {
  happy: { name: '愉悦', emoji: '😊', color: '#FFD700', desc: '欢快明亮的旋律' },
  sad: { name: '忧伤', emoji: '😢', color: '#4682B4', desc: '舒缓深情的曲调' },
  energetic: { name: '活力', emoji: '🔥', color: '#FF4500', desc: '节奏强劲的音乐' },
  calm: { name: '宁静', emoji: '🌙', color: '#9370DB', desc: '安静祥和的氛围' },
  romantic: { name: '浪漫', emoji: '💖', color: '#FF69B4', desc: '温柔甜蜜的旋律' },
  focus: { name: '专注', emoji: '🎯', color: '#4169E1', desc: '帮助集中注意力' },
  party: { name: '派对', emoji: '🎉', color: '#FF1493', desc: '嗨翻全场的节奏' },
}

/** 获取心情元数据 */
export const getMoodMeta = (mood: Mood) => MOOD_META[mood]

/** 根据时间推断基础心情 */
const inferMoodByTime = (date: Date): Mood => {
  const hour = date.getHours()
  if (hour >= 6 && hour < 9) return 'energetic' // 早晨活力
  if (hour >= 9 && hour < 12) return 'focus' // 上午专注
  if (hour >= 12 && hour < 14) return 'calm' // 中午宁静
  if (hour >= 14 && hour < 18) return 'focus' // 下午专注
  if (hour >= 18 && hour < 22) return 'romantic' // 傍晚浪漫
  if (hour >= 22 || hour < 2) return 'calm' // 深夜宁静
  return 'sad' // 凌晨忧郁
}

/** 根据歌名/歌手关键词推断心情 */
const inferMoodFromText = (name: string, singer: string): Mood | null => {
  const text = (name + ' ' + singer).toLowerCase()
  const keywords: Record<Mood, string[]> = {
    happy: ['快乐', '阳光', 'happy', '微笑', '舞', 'dance', 'sunshine', '晴天', '彩虹'],
    sad: ['伤心', '泪', 'sad', 'cry', '孤独', 'lonely', 'miss', '想念', '离开', '分手'],
    energetic: ['rock', '金属', '热血', '战斗', 'fight', 'power', '燃', '激烈', '快'],
    calm: ['夜', 'moon', '安静', 'silent', '宁静', '轻柔', '钢琴', 'piano', 'sleep'],
    romantic: ['爱', 'love', '心', 'heart', '玫瑰', '浪漫', 'romantic', '温柔', '甜蜜'],
    focus: ['纯音乐', 'instrumental', 'study', '古典', 'classical', 'ambient'],
    party: ['party', 'dj', '电音', 'edm', 'dance', 'club', '嗨'],
  }
  for (const [mood, kws] of Object.entries(keywords)) {
    if (kws.some((kw) => text.includes(kw))) return mood as Mood
  }
  return null
}

/** 分析近期听歌心情 */
export const analyzeMood = async (days = 7): Promise<MoodAnalysis> => {
  const now = Date.now()
  const startTime = now - days * 24 * 60 * 60 * 1000
  const history = await getPlayHistoryByRange(startTime, now)

  const moodCount: Record<Mood, number> = {
    happy: 0, sad: 0, energetic: 0, calm: 0, romantic: 0, focus: 0, party: 0,
  }
  const artistCount = new Map<string, number>()
  let totalTime = 0

  for (const item of history) {
    const mood = inferMoodFromText(item.musicInfo.name, item.musicInfo.singer)
    if (mood) moodCount[mood]++
    const artist = item.musicInfo.singer
    artistCount.set(artist, (artistCount.get(artist) || 0) + 1)
    totalTime += item.playTime
  }

  // 找出主导心情
  let dominantMood: Mood = inferMoodByTime(new Date())
  let maxCount = 0
  for (const [mood, count] of Object.entries(moodCount)) {
    if (count > maxCount) {
      maxCount = count
      dominantMood = mood as Mood
    }
  }

  // 置信度：基于样本数和占比
  const total = Object.values(moodCount).reduce((a, b) => a + b, 0)
  const confidence = total > 0 ? Math.min(100, Math.round((maxCount / total) * 100)) : 50

  const topArtists = Array.from(artistCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)

  // 推断节奏（基于心情）
  const tempoMap: Record<Mood, 'slow' | 'medium' | 'fast'> = {
    happy: 'medium', sad: 'slow', energetic: 'fast', calm: 'slow',
    romantic: 'slow', focus: 'medium', party: 'fast',
  }

  return {
    mood: dominantMood,
    confidence,
    reason: total === 0
      ? '暂无听歌记录，已根据当前时间推荐'
      : `基于最近${days}天听歌记录分析，${getMoodMeta(dominantMood).name}心情占比${confidence}%`,
    topGenres: [],
    topArtists,
    averageTempo: tempoMap[dominantMood],
  }
}

/** 生成心情推荐歌单 */
export const generateMoodRecommendations = async (
  allSongs: MusicInfo[],
  days = 7
): Promise<MoodRecommendResult> => {
  const analysis = await analyzeMood(days)
  const moodMeta = getMoodMeta(analysis.mood)

  // 根据心情从所有歌曲中筛选
  const scored = allSongs.map((song) => {
    let score = 0
    const mood = inferMoodFromText(song.name, song.singer)
    if (mood === analysis.mood) score += 50
    if (analysis.topArtists.includes(song.singer)) score += 30
    // 随机加分增加多样性
    score += Math.random() * 20
    return { song, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const recommendations = scored.slice(0, 30).map((s) => s.song)

  return {
    analysis: {
      ...analysis,
      reason: analysis.reason + `。推荐了${recommendations.length}首${moodMeta.desc}。`,
    },
    recommendations,
  }
}
