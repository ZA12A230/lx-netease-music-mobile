/**
 * 歌词翻译PK
 * 将歌词翻译与AI翻译对比，学习外语表达
 */
import { chat } from '@/core/ai'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

type MusicInfo = LX.Music.MusicInfo

export type TargetLanguage = 'en' | 'ja' | 'ko' | 'zh' | 'fr' | 'de' | 'es' | 'pt'

export interface TranslationRound {
  /** 原始歌词行 */
  original: string
  /** 用户翻译 */
  userTranslation: string
  /** AI参考翻译 */
  aiTranslation: string
  /** 评分 0-100 */
  score: number
  /** 反馈 */
  feedback: string
  /** 关键词汇 */
  keywords: Array<{ word: string; meaning: string }>
}

export interface TranslationChallenge {
  id: string
  song: { name: string; singer: string }
  sourceLanguage: string
  targetLanguage: TargetLanguage
  rounds: TranslationRound[]
  totalScore: number
  averageScore: number
  createdAt: number
  completedAt?: number
  difficulty: 'easy' | 'normal' | 'hard'
}

export interface TranslationStats {
  totalChallenges: number
  totalRounds: number
  averageScore: number
  bestScore: number
  streak: number
  lastPlayedAt?: number
  targetLanguageStats: Record<string, { count: number; avgScore: number }>
}

const CHALLENGES_KEY = '@translation_pk_challenges_v1'
const STATS_KEY = '@translation_pk_stats_v1'
const MAX_CHALLENGES = 30

const LANGUAGE_NAMES: Record<TargetLanguage, string> = {
  en: '英文', ja: '日文', ko: '韩文', zh: '中文',
  fr: '法文', de: '德文', es: '西班牙文', pt: '葡萄牙文',
}

/** 创建翻译挑战 */
export const createChallenge = async (
  song: MusicInfo,
  lyricLines: string[],
  targetLanguage: TargetLanguage,
  difficulty: 'easy' | 'normal' | 'hard' = 'normal',
): Promise<TranslationChallenge | null> => {
  if (lyricLines.length < 3) {
    addDevLog('warn', 'TranslationPK', '歌词行数不足')
    return null
  }

  const lineCount = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 5 : 8
  const selectedLines = pickLines(lyricLines, lineCount)

  const challenge: TranslationChallenge = {
    id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    song: { name: song.name, singer: song.singer },
    sourceLanguage: '中文',
    targetLanguage,
    rounds: [],
    totalScore: 0,
    averageScore: 0,
    createdAt: Date.now(),
    difficulty,
  }

  // 为每行生成AI翻译
  const langName = LANGUAGE_NAMES[targetLanguage]
  for (const line of selectedLines) {
    const prompt = `请将以下中文歌词翻译成${langName}：

"${line}"

要求：
1. 翻译要自然流畅，符合${langName}的表达习惯
2. 尽量保留原歌词的意境和美感
3. 只输出翻译结果，不要解释

同时输出：
翻译：xxx
关键词汇：
- 原文词1 | 翻译1
- 原文词2 | 翻译2`

    try {
      const result = await chat(prompt, [])
      if (!result?.trim()) continue

      const { translation, keywords } = parseTranslationResult(result)
      challenge.rounds.push({
        original: line,
        userTranslation: '',
        aiTranslation: translation || line,
        score: 0,
        feedback: '',
        keywords: keywords.length > 0 ? keywords : [{ word: line.slice(0, 4), meaning: translation?.slice(0, 10) || '' }],
      })
    } catch {
      // 跳过失败的行
    }
  }

  if (challenge.rounds.length === 0) {
    addDevLog('error', 'TranslationPK', '翻译生成失败')
    return null
  }

  await saveChallenge(challenge)
  addDevLog('info', 'TranslationPK', `创建挑战: ${song.name}, ${challenge.rounds.length}轮`)
  return challenge
}

/** 从歌词中选取行 */
const pickLines = (lines: string[], count: number): string[] => {
  const filtered = lines.filter((l) => l.trim().length > 5 && !/^[\s\[【]/.test(l))
  if (filtered.length <= count) return filtered.slice(0, count)

  const shuffled = [...filtered].sort(() => Math.random() - 0.5)
  const result: string[] = []
  const used = new Set<number>()
  for (const line of shuffled) {
    const idx = filtered.indexOf(line)
    if (used.has(idx)) continue
    used.add(idx)
    result.push(line)
    if (result.length >= count) break
  }
  return result
}

/** 解析AI翻译结果 */
const parseTranslationResult = (result: string): { translation: string; keywords: Array<{ word: string; meaning: string }> } => {
  const text = result.trim()
  let translation = ''
  const keywords: Array<{ word: string; meaning: string }> = []

  const translationMatch = text.match(/翻译[:：]\s*(.+)/i)
  if (translationMatch) {
    translation = translationMatch[1].trim()
  } else {
    // 第一行作为翻译
    const lines = text.split('\n')
    translation = lines[0].replace(/^[【《#]/g, '').replace(/[】》#]/g, '').trim()
  }

  const kwRegex = /[-•]\s*(\S+?)\s*[|｜]\s*(.+)/g
  let match
  while ((match = kwRegex.exec(text)) !== null) {
    keywords.push({ word: match[1].trim(), meaning: match[2].trim() })
  }

  return { translation, keywords }
}

/** 提交翻译并评分 */
export const submitTranslation = (
  challenge: TranslationChallenge,
  roundIndex: number,
  userTranslation: string,
): TranslationRound | null => {
  const round = challenge.rounds[roundIndex]
  if (!round) return null

  round.userTranslation = userTranslation

  // 简单评分：与AI翻译的相似度
  const score = calculateSimilarityScore(userTranslation, round.aiTranslation)
  round.score = score

  // 生成反馈
  round.feedback = generateFeedback(score, round.aiTranslation)

  // 更新总分
  let totalScore = 0
  for (const r of challenge.rounds) {
    totalScore += r.score
  }
  challenge.totalScore = totalScore
  challenge.averageScore = Math.round(totalScore / challenge.rounds.length)

  // 全部完成
  if (challenge.rounds.every((r) => r.userTranslation)) {
    challenge.completedAt = Date.now()
  }

  return round
}

/** 计算相似度评分（简化版） */
const calculateSimilarityScore = (user: string, ai: string): number => {
  if (!user.trim() || !ai.trim()) return 0

  const userWords = new Set(user.toLowerCase().split(/\s+/).filter(Boolean))
  const aiWords = new Set(ai.toLowerCase().split(/\s+/).filter(Boolean))

  if (aiWords.size === 0) return 0

  let overlap = 0
  for (const w of userWords) {
    if (aiWords.has(w)) overlap++
  }

  // 基础分 + 重叠率
  const base = 60
  const overlapRate = overlap / Math.max(aiWords.size, 1)
  return Math.min(100, Math.round(base + overlapRate * 40))
}

/** 生成反馈 */
const generateFeedback = (score: number, aiTranslation: string): string => {
  if (score >= 90) return '太棒了！你的翻译非常接近参考翻译！👍'
  if (score >= 70) return '不错！意思基本正确，继续加油！💪'
  if (score >= 50) return '大致方向对了，但可以更准确一些。参考：' + aiTranslation
  return '继续尝试！想想歌词的意境。参考：' + aiTranslation
}

/** 保存挑战 */
const saveChallenge = async (challenge: TranslationChallenge): Promise<void> => {
  const all = await getAllChallenges()
  const idx = all.findIndex((c) => c.id === challenge.id)
  if (idx >= 0) {
    all[idx] = challenge
  } else {
    all.unshift(challenge)
  }
  await saveData(CHALLENGES_KEY, all.slice(0, MAX_CHALLENGES))

  // 更新统计
  if (challenge.completedAt) {
    await updateStats(challenge)
  }
}

/** 获取所有挑战 */
export const getAllChallenges = async (): Promise<TranslationChallenge[]> => {
  const data = await getData<TranslationChallenge[]>(CHALLENGES_KEY)
  return data || []
}

/** 完成挑战 */
export const completeChallenge = async (challenge: TranslationChallenge): Promise<void> => {
  challenge.completedAt = Date.now()
  await saveChallenge(challenge)
}

/** 获取统计 */
export const getStats = async (): Promise<TranslationStats> => {
  const data = await getData<TranslationStats>(STATS_KEY)
  return data || {
    totalChallenges: 0,
    totalRounds: 0,
    averageScore: 0,
    bestScore: 0,
    streak: 0,
    targetLanguageStats: {},
  }
}

/** 更新统计 */
const updateStats = async (challenge: TranslationChallenge): Promise<void> => {
  const stats = await getStats()
  stats.totalChallenges++
  stats.totalRounds += challenge.rounds.length
  stats.bestScore = Math.max(stats.bestScore, challenge.totalScore)

  const totalScoreSum = (stats.averageScore * (stats.totalChallenges - 1)) + challenge.averageScore
  stats.averageScore = Math.round(totalScoreSum / stats.totalChallenges)

  const langKey = String(challenge.targetLanguage)
  if (!stats.targetLanguageStats[langKey]) {
    stats.targetLanguageStats[langKey] = { count: 0, avgScore: 0 }
  }
  const langStat = stats.targetLanguageStats[langKey]
  langStat.avgScore = Math.round((langStat.avgScore * langStat.count + challenge.averageScore) / (langStat.count + 1))
  langStat.count++

  await saveData(STATS_KEY, stats)
}

/** 获取语言名 */
export const getLanguageName = (lang: TargetLanguage): string => LANGUAGE_NAMES[lang]

/** 获取所有目标语言 */
export const getAllLanguages = (): Array<{ key: TargetLanguage; name: string }> =>
  Object.entries(LANGUAGE_NAMES).map(([key, name]) => ({
    key: key as TargetLanguage,
    name,
  }))

/** 获取难度名 */
export const getDifficultyName = (d: 'easy' | 'normal' | 'hard'): string => {
  const map = { easy: '简单', normal: '普通', hard: '困难' }
  return map[d]
}

/** 获取所有难度 */
export const getAllDifficulties = (): Array<{ key: string; name: string; desc: string }> => [
  { key: 'easy', name: '简单', desc: '3行歌词翻译' },
  { key: 'normal', name: '普通', desc: '5行歌词翻译' },
  { key: 'hard', name: '困难', desc: '8行歌词翻译' },
]

/** 清空所有数据 */
export const clearAllData = async (): Promise<void> => {
  await saveData(CHALLENGES_KEY, [])
  await saveData(STATS_KEY, null)
  addDevLog('info', 'TranslationPK', '所有数据已清空')
}

/** 生成挑战报告 */
export const generateChallengeReport = (challenge: TranslationChallenge): string => {
  let text = `📝 歌词翻译PK\n\n`
  text += `🎵 ${challenge.song.name} - ${challenge.song.singer}\n`
  text += `🌐 目标语言: ${LANGUAGE_NAMES[challenge.targetLanguage]}\n`
  text += `📊 总分: ${challenge.totalScore} / ${challenge.rounds.length * 100}\n`
  text += `📈 平均: ${challenge.averageScore}分\n\n`

  for (let i = 0; i < challenge.rounds.length; i++) {
    const r = challenge.rounds[i]
    text += `\n第${i + 1}轮 (${r.score}分)\n`
    text += `  原文: ${r.original}\n`
    text += `  你的: ${r.userTranslation || '未作答'}\n`
    text += `  参考: ${r.aiTranslation}\n`
    text += `  ${r.feedback}\n`
  }

  return text
}