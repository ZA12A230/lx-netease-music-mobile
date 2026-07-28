/**
 * 歌词学习闪卡
 * 从歌词中提取生词，制作成闪卡进行记忆复习（艾宾浩斯记忆法）
 */
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

export type CardStatus = 'new' | 'learning' | 'review' | 'mastered'

export interface Flashcard {
  id: string
  word: string
  /** 上下文（歌词原句） */
  context: string
  /** 翻译/释义 */
  meaning: string
  /** 来源歌曲 */
  sourceSong?: { name: string; singer: string }
  /** 创建时间 */
  createdAt: number
  /** 上次复习时间 */
  lastReviewedAt?: number
  /** 下次复习时间 */
  nextReviewAt: number
  /** 复习次数 */
  reviewCount: number
  /** 正确次数 */
  correctCount: number
  /** 错误次数 */
  wrongCount: number
  /** 状态 */
  status: CardStatus
  /** 难度（0-5，越高越难） */
  difficulty: number
  /** 间隔（天） */
  interval: number
  /** 简单因子（SM-2算法） */
  easeFactor: number
}

export interface ReviewSession {
  id: string
  startTime: number
  endTime?: number
  totalCards: number
  reviewed: number
  correct: number
  wrong: number
  cards: Array<{ cardId: string; correct: boolean; reviewedAt: number }>
}

export interface FlashcardStats {
  totalCards: number
  mastered: number
  learning: number
  newCards: number
  reviewDue: number
  averageAccuracy: number
  streak: number
  lastStudyDate?: string
  totalReviews: number
}

const CARDS_KEY = '@lyric_flashcards_v1'
const SESSION_KEY = '@lyric_flashcard_sessions_v1'
const STATS_KEY = '@lyric_flashcard_stats_v1'
const MAX_SESSIONS = 50

/** 艾宾浩斯复习间隔（天） */
const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30, 60, 120]

/** 从歌词中提取候选词（中文/英文） */
export const extractWordsFromLyric = (lyric: string): Array<{ word: string; context: string }> => {
  const result: Array<{ word: string; context: string }> = []
  const seen = new Set<string>()

  // 按行处理
  const lines = lyric.split(/\n+/).filter((l) => l.trim())
  for (const line of lines) {
    const cleanLine = line.replace(/\[[\d:.]+\]/g, '').trim() // 去除时间标签
    if (!cleanLine) continue

    // 英文单词（长度>=4）
    const englishWords = cleanLine.match(/\b[a-zA-Z]{4,}\b/g) || []
    for (const w of englishWords) {
      const lower = w.toLowerCase()
      // 过滤常见词
      if (STOP_WORDS.has(lower)) continue
      if (seen.has(lower)) continue
      seen.add(lower)
      result.push({ word: w, context: cleanLine })
    }

    // 中文词组（连续2-4个汉字，简化处理）
    const chineseWords = cleanLine.match(/[\u4e00-\u9fa5]{2,4}/g) || []
    for (const w of chineseWords) {
      if (seen.has(w)) continue
      seen.add(w)
      result.push({ word: w, context: cleanLine })
    }
  }

  return result.slice(0, 50) // 最多返回50个
}

/** 创建闪卡 */
export const createCard = (
  word: string,
  context: string,
  meaning: string = '',
  sourceSong?: { name: string; singer: string },
): Flashcard => {
  const now = Date.now()
  return {
    id: `card_${now}_${Math.random().toString(36).slice(2, 6)}`,
    word,
    context,
    meaning,
    sourceSong,
    createdAt: now,
    nextReviewAt: now, // 立即可复习
    reviewCount: 0,
    correctCount: 0,
    wrongCount: 0,
    status: 'new',
    difficulty: 0,
    interval: 0,
    easeFactor: 2.5,
  }
}

/** 保存闪卡 */
export const saveCard = async (card: Flashcard): Promise<void> => {
  const all = await getAllCards()
  const idx = all.findIndex((c) => c.id === card.id)
  if (idx >= 0) {
    all[idx] = card
  } else {
    all.unshift(card)
  }
  await saveData(CARDS_KEY, all.slice(0, 500)) // 最多500张
  addDevLog('info', 'Flashcard', `保存卡片: ${card.word}`)
}

/** 批量创建卡片 */
export const saveCards = async (cards: Flashcard[]): Promise<void> => {
  const existing = await getAllCards()
  const all = [...cards, ...existing]
  await saveData(CARDS_KEY, all.slice(0, 500))
  addDevLog('info', 'Flashcard', `批量保存${cards.length}张卡片`)
}

/** 获取所有卡片 */
export const getAllCards = async (): Promise<Flashcard[]> => {
  const data = await getData<Flashcard[]>(CARDS_KEY)
  return data || []
}

/** 获取待复习的卡片 */
export const getDueCards = async (): Promise<Flashcard[]> => {
  const all = await getAllCards()
  const now = Date.now()
  return all.filter((c) => c.nextReviewAt <= now && c.status !== 'mastered')
}

/** 删除卡片 */
export const deleteCard = async (id: string): Promise<void> => {
  const all = await getAllCards()
  await saveData(CARDS_KEY, all.filter((c) => c.id !== id))
}

/** SM-2 算法更新卡片（基于SuperMemo 2） */
export const reviewCard = (card: Flashcard, correct: boolean): Flashcard => {
  const now = Date.now()
  const updated = { ...card }

  updated.reviewCount++
  updated.lastReviewedAt = now

  if (correct) {
    updated.correctCount++
    // 正确：增加间隔
    if (updated.reviewCount === 1) {
      updated.interval = 1
    } else if (updated.reviewCount === 2) {
      updated.interval = 3
    } else {
      updated.interval = Math.round(updated.interval * updated.easeFactor)
    }
    updated.easeFactor = Math.max(1.3, updated.easeFactor + 0.1)

    // 难度递减
    updated.difficulty = Math.max(0, updated.difficulty - 1)

    // 状态升级
    if (updated.reviewCount >= 5 && updated.correctCount / updated.reviewCount >= 0.9) {
      updated.status = 'mastered'
    } else {
      updated.status = 'review'
    }
  } else {
    updated.wrongCount++
    // 错误：重置间隔
    updated.interval = 1
    updated.easeFactor = Math.max(1.3, updated.easeFactor - 0.2)

    // 难度递增
    updated.difficulty = Math.min(5, updated.difficulty + 1)

    // 状态降级
    updated.status = 'learning'
  }

  // 下次复习时间
  updated.nextReviewAt = now + updated.interval * 24 * 60 * 60 * 1000

  return updated
}

/** 创建复习会话 */
export const createReviewSession = (cardIds: string[]): ReviewSession => {
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    startTime: Date.now(),
    totalCards: cardIds.length,
    reviewed: 0,
    correct: 0,
    wrong: 0,
    cards: [],
  }
}

/** 更新复习会话 */
export const updateReviewSession = (
  session: ReviewSession,
  cardId: string,
  correct: boolean,
): void => {
  session.reviewed++
  if (correct) session.correct++
  else session.wrong++
  session.cards.push({ cardId, correct, reviewedAt: Date.now() })
}

/** 结束复习会话 */
export const finishReviewSession = async (session: ReviewSession): Promise<void> => {
  session.endTime = Date.now()
  const sessions = await getSessions()
  sessions.unshift(session)
  await saveData(SESSION_KEY, sessions.slice(0, MAX_SESSIONS))

  // 更新统计
  await updateStats(session)
  addDevLog('info', 'Flashcard', `复习会话结束: ${session.reviewed}张, 正确${session.correct}张`)
}

/** 获取会话历史 */
export const getSessions = async (): Promise<ReviewSession[]> => {
  const data = await getData<ReviewSession[]>(SESSION_KEY)
  return data || []
}

/** 更新统计 */
const updateStats = async (session: ReviewSession): Promise<void> => {
  const stats = await getStats()
  stats.totalReviews++
  const today = new Date().toISOString().slice(0, 10)
  // streak 逻辑：当天第一次学习才更新
  if (stats.lastStudyDate !== today) {
    if (stats.lastStudyDate === yesterday()) {
      stats.streak++ // 连续学习+1
    } else {
      stats.streak = 1 // 断签重置为1
    }
    stats.lastStudyDate = today
  }

  const allCards = await getAllCards()
  stats.totalCards = allCards.length
  stats.mastered = allCards.filter((c) => c.status === 'mastered').length
  stats.learning = allCards.filter((c) => c.status === 'learning' || c.status === 'review').length
  stats.newCards = allCards.filter((c) => c.status === 'new').length
  stats.reviewDue = (await getDueCards()).length

  // 平均正确率
  const totalAnswers = allCards.reduce((s, c) => s + c.correctCount + c.wrongCount, 0)
  const totalCorrect = allCards.reduce((s, c) => s + c.correctCount, 0)
  stats.averageAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0

  await saveData(STATS_KEY, stats)
}

const yesterday = (): string => {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

/** 获取统计 */
export const getStats = async (): Promise<FlashcardStats> => {
  const data = await getData<FlashcardStats>(STATS_KEY)
  return data || {
    totalCards: 0,
    mastered: 0,
    learning: 0,
    newCards: 0,
    reviewDue: 0,
    averageAccuracy: 0,
    streak: 0,
    totalReviews: 0,
  }
}

/** 获取艾宾浩斯复习时间表 */
export const getReviewSchedule = (card: Flashcard): Array<{ day: number; label: string }> => {
  return REVIEW_INTERVALS.map((day, i) => ({
    day,
    label: i === 0 ? '1天后' : day < 7 ? `${day}天后` : day < 30 ? `${Math.round(day / 7)}周后` : `${Math.round(day / 30)}个月后`,
  }))
}

/** 简单英文停用词表 */
const STOP_WORDS = new Set<string>([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our',
  'out', 'has', 'have', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did',
  'get', 'let', 'say', 'she', 'too', 'use', 'this', 'that', 'with', 'from', 'they', 'will', 'would',
  'there', 'their', 'what', 'about', 'which', 'when', 'your', 'them', 'then', 'than', 'been', 'want',
  'were', 'some', 'what', 'into', 'just', 'like', 'make', 'more', 'only', 'over', 'such', 'take',
  'time', 'very', 'when', 'year', 'also', 'back', 'come', 'made', 'find', 'here', 'know', 'many',
  'most', 'other', 'people', 'said', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'where',
  'while', 'before', 'after', 'because', 'against', 'between', 'through', 'during', 'above', 'below',
  'should', 'could', 'might', 'must', 'shall', 'will', 'would', 'song', 'sing', 'love', 'baby',
])

/** 重置所有卡片状态（重新开始学习） */
export const resetAllCards = async (): Promise<void> => {
  const all = await getAllCards()
  const now = Date.now()
  for (const c of all) {
    c.status = 'new'
    c.reviewCount = 0
    c.correctCount = 0
    c.wrongCount = 0
    c.interval = 0
    c.easeFactor = 2.5
    c.difficulty = 0
    c.nextReviewAt = now
    c.lastReviewedAt = undefined
  }
  await saveData(CARDS_KEY, all)
  addDevLog('info', 'Flashcard', `重置${all.length}张卡片`)
}

/** 清空所有数据 */
export const clearAllData = async (): Promise<void> => {
  await saveData(CARDS_KEY, [])
  await saveData(SESSION_KEY, [])
  await saveData(STATS_KEY, null)
  addDevLog('info', 'Flashcard', '所有数据已清空')
}

/** 获取状态名 */
export const getStatusName = (status: CardStatus): string => {
  const map: Record<CardStatus, string> = {
    new: '新词',
    learning: '学习中',
    review: '复习中',
    mastered: '已掌握',
  }
  return map[status]
}

/** 生成学习报告 */
export const generateStudyReport = async (): Promise<string> => {
  const stats = await getStats()
  const all = await getAllCards()
  let text = `📚 歌词学习闪卡报告\n\n`
  text += `📊 总览：${stats.totalCards}张卡片\n`
  text += `  ✅ 已掌握: ${stats.mastered}\n`
  text += `  📖 学习中: ${stats.learning}\n`
  text += `  🆕 新词: ${stats.newCards}\n`
  text += `  ⏰ 待复习: ${stats.reviewDue}\n\n`
  text += `📈 正确率: ${stats.averageAccuracy}%\n`
  text += `🔥 连续学习: ${stats.streak}天\n`
  text += `📝 总复习次数: ${stats.totalReviews}\n`

  if (all.length > 0) {
    const difficult = all.filter((c) => c.difficulty >= 3).sort((a, b) => b.difficulty - a.difficulty).slice(0, 5)
    if (difficult.length > 0) {
      text += `\n💪 难词Top${difficult.length}：\n`
      for (const c of difficult) {
        text += `  • ${c.word} (难度${c.difficulty}, 错${c.wrongCount}次)\n`
      }
    }
  }

  return text
}
