/**
 * 音乐学习模式模块
 * 通过歌词学习外语：单词卡片、跟读练习、听力测验
 */
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

export type LearningLanguage = 'english' | 'japanese' | 'korean' | 'french' | 'spanish' | 'german'

export interface VocabularyCard {
  id: string
  word: string
  translation: string
  language: LearningLanguage
  source: {
    songName: string
    singer: string
    context: string // 歌词上下文
  }
  /** 难度 1-5 */
  difficulty: number
  /** 复习次数 */
  reviewCount: number
  /** 正确次数 */
  correctCount: number
  /** 上次复习时间 */
  lastReviewAt: number
  /** 下次复习时间 */
  nextReviewAt: number
  /** 已掌握 */
  mastered: boolean
  createdAt: number
}

export interface LearningSession {
  id: string
  startedAt: number
  endedAt: number
  duration: number // 秒
  cardsReviewed: number
  correctCount: number
  language: LearningLanguage
  newWordsLearned: number
}

export interface LearningProgress {
  totalWords: number
  masteredWords: number
  learningWords: number
  newWords: number
  streakDays: number
  totalReviews: number
  averageAccuracy: number
  byLanguage: Record<LearningLanguage, number>
}

const VOCAB_KEY = '@learning_vocab_v1'
const SESSION_KEY = '@learning_sessions_v1'

const LANGUAGE_NAMES: Record<LearningLanguage, string> = {
  english: '英语',
  japanese: '日语',
  korean: '韩语',
  french: '法语',
  spanish: '西班牙语',
  german: '德语',
}

const detectLanguage = (text: string): LearningLanguage | null => {
  if (/[a-zA-Z]/.test(text) && !/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text)) return 'english'
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'japanese'
  if (/[\uac00-\ud7af]/.test(text)) return 'korean'
  return null
}

/** 从歌词中提取单词 */
export const extractVocabularyFromLyrics = (
  lyrics: string,
  songName: string,
  singer: string,
): VocabularyCard[] => {
  const cards: VocabularyCard[] = []
  const lines = lyrics.split('\n')
  const seenWords = new Set<string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('[')) continue

    const lang = detectLanguage(trimmed)
    if (lang !== 'english') continue // 目前仅支持英语提取

    // 提取单词（去除标点）
    const words = trimmed.toLowerCase().match(/\b[a-z]{2,}\b/g) || []
    for (const word of words) {
      // 过滤常见词
      if (COMMON_WORDS.has(word)) continue
      if (seenWords.has(word)) continue
      seenWords.add(word)

      // 简单难度判断
      let difficulty = 1
      if (word.length >= 7) difficulty = 3
      else if (word.length >= 5) difficulty = 2

      cards.push({
        id: `vocab_${word}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        word,
        translation: '', // 需要后续翻译
        language: lang,
        source: {
          songName,
          singer,
          context: trimmed,
        },
        difficulty,
        reviewCount: 0,
        correctCount: 0,
        lastReviewAt: 0,
        nextReviewAt: Date.now(),
        mastered: false,
        createdAt: Date.now(),
      })
    }
  }

  return cards
}

/** 常见英文单词（CET-4基础词） */
const COMMON_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its',
  'our', 'their', 'this', 'that', 'these', 'those', 'of', 'in', 'on', 'at',
  'to', 'for', 'with', 'by', 'from', 'as', 'into', 'about', 'than', 'then',
  'so', 'if', 'because', 'while', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
  'only', 'own', 'same', 'too', 'very', 'just', 'now', 'here', 'there',
])

/** 保存单词卡片 */
export const saveVocabulary = async (cards: VocabularyCard[]): Promise<void> => {
  const existing = await getAllVocabulary()
  const existingWords = new Set(existing.map((c) => c.word))
  const newCards = cards.filter((c) => !existingWords.has(c.word))
  await saveData(VOCAB_KEY, [...existing, ...newCards])
  addDevLog('info', 'Learning', `保存${newCards.length}个新单词`)
}

/** 获取所有单词卡片 */
export const getAllVocabulary = async (): Promise<VocabularyCard[]> => {
  const data = await getData<VocabularyCard[]>(VOCAB_KEY)
  return data || []
}

/** 获取需要复习的单词 */
export const getDueCards = async (limit = 20): Promise<VocabularyCard[]> => {
  const all = await getAllVocabulary()
  const now = Date.now()
  return all
    .filter((c) => !c.mastered && c.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
    .slice(0, limit)
}

/** 更新单词卡片（基于艾宾浩斯遗忘曲线） */
export const reviewCard = async (cardId: string, correct: boolean): Promise<void> => {
  const all = await getAllVocabulary()
  const card = all.find((c) => c.id === cardId)
  if (!card) return

  card.reviewCount++
  if (correct) {
    card.correctCount++
  }
  card.lastReviewAt = Date.now()

  // 艾宾浩斯间隔复习
  const intervals = [5 * 60 * 1000, 30 * 60 * 1000, 12 * 60 * 60 * 1000, 24 * 60 * 60 * 1000, 2 * 24 * 60 * 60 * 1000, 4 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000, 15 * 24 * 60 * 60 * 1000]
  const level = correct ? Math.min(card.reviewCount, intervals.length - 1) : 0
  card.nextReviewAt = Date.now() + intervals[level]

  // 连续答对5次以上视为掌握
  if (card.correctCount >= 5 && card.correctCount / card.reviewCount >= 0.8) {
    card.mastered = true
  }

  await saveData(VOCAB_KEY, all)
}

/** 重置单词卡片 */
export const resetCard = async (cardId: string): Promise<void> => {
  const all = await getAllVocabulary()
  const card = all.find((c) => c.id === cardId)
  if (card) {
    card.reviewCount = 0
    card.correctCount = 0
    card.mastered = false
    card.nextReviewAt = Date.now()
    await saveData(VOCAB_KEY, all)
  }
}

/** 删除单词卡片 */
export const deleteCard = async (cardId: string): Promise<void> => {
  const all = await getAllVocabulary()
  await saveData(VOCAB_KEY, all.filter((c) => c.id !== cardId))
}

/** 记录学习会话 */
export const recordSession = async (session: Omit<LearningSession, 'id'>): Promise<void> => {
  const data = await getData<LearningSession[]>(SESSION_KEY)
  const sessions = data || []
  const newSession: LearningSession = {
    ...session,
    id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  }
  sessions.unshift(newSession)
  if (sessions.length > 500) sessions.length = 500
  await saveData(SESSION_KEY, sessions)
}

/** 获取学习进度 */
export const getLearningProgress = async (): Promise<LearningProgress> => {
  const all = await getAllVocabulary()
  const sessions = await getData<LearningSession[]>(SESSION_KEY) || []

  const masteredWords = all.filter((c) => c.mastered).length
  const learningWords = all.filter((c) => !c.mastered && c.reviewCount > 0).length
  const newWords = all.filter((c) => c.reviewCount === 0).length

  const byLanguage: Record<LearningLanguage, number> = {
    english: 0, japanese: 0, korean: 0, french: 0, spanish: 0, german: 0,
  }
  for (const c of all) {
    byLanguage[c.language]++
  }

  // 计算连续学习天数
  let streakDays = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const hasSession = sessions.some((s) => {
      const sessionDate = new Date(s.startedAt).toISOString().split('T')[0]
      return sessionDate === dateStr
    })
    if (hasSession) {
      streakDays++
    } else if (i > 0) {
      break
    }
  }

  const totalReviews = sessions.reduce((sum, s) => sum + s.cardsReviewed, 0)
  const totalCorrect = sessions.reduce((sum, s) => sum + s.correctCount, 0)
  const averageAccuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0

  return {
    totalWords: all.length,
    masteredWords,
    learningWords,
    newWords,
    streakDays,
    totalReviews,
    averageAccuracy,
    byLanguage,
  }
}

/** 获取最近的学习会话 */
export const getRecentSessions = async (limit = 10): Promise<LearningSession[]> => {
  const data = await getData<LearningSession[]>(SESSION_KEY)
  return (data || []).slice(0, limit)
}

/** 听力测验：随机选取已掌握的单词进行测验 */
export const createListeningQuiz = async (count = 10): Promise<Array<{
  card: VocabularyCard
  options: string[]
  correctIndex: number
}>> => {
  const all = await getAllVocabulary()
  const mastered = all.filter((c) => c.mastered && c.translation)

  if (mastered.length < 4) return []

  const quiz: Array<{ card: VocabularyCard; options: string[]; correctIndex: number }> = []
  const used = new Set<string>()

  for (let i = 0; i < Math.min(count, mastered.length); i++) {
    let card = mastered[Math.floor(Math.random() * mastered.length)]
    while (used.has(card.id)) {
      card = mastered[Math.floor(Math.random() * mastered.length)]
    }
    used.add(card.id)

    // 生成4个选项
    const otherCards = mastered.filter((c) => c.id !== card.id && c.translation !== card.translation)
    const shuffled = otherCards.sort(() => Math.random() - 0.5).slice(0, 3)
    const options = [card.translation, ...shuffled.map((c) => c.translation)]
      .sort(() => Math.random() - 0.5)
    const correctIndex = options.indexOf(card.translation)

    quiz.push({ card, options, correctIndex })
  }

  return quiz
}

/** 获取语言名称 */
export const getLanguageName = (lang: LearningLanguage): string => LANGUAGE_NAMES[lang]

/** 清空所有学习数据 */
export const clearAllLearningData = async (): Promise<void> => {
  await saveData(VOCAB_KEY, [])
  await saveData(SESSION_KEY, [])
  addDevLog('info', 'Learning', '所有学习数据已清空')
}
