/**
 * 音乐PK对战
 * 基于歌单的双人/人机音乐知识对战游戏
 */
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

type MusicInfo = LX.Music.MusicInfo

export type PKQuestionType =
  | 'song_by_lyric'    // 根据歌词猜歌名
  | 'artist_by_song'   // 根据歌名猜歌手
  | 'song_by_artist'   // 根据歌手猜歌名
  | 'year_by_song'     // 猜发行年代
  | 'lyric_by_song'    // 根据歌名猜歌词

export type PKDifficulty = 'easy' | 'normal' | 'hard'

export interface PKQuestion {
  id: string
  type: PKQuestionType
  difficulty: PKDifficulty
  prompt: string
  options: string[]
  correctAnswer: string
  hint?: string
  sourceSong: MusicInfo
}

export interface PKPlayer {
  id: string
  name: string
  avatar?: string
  score: number
  correctCount: number
  wrongCount: number
  streak: number       // 连击数
  maxStreak: number
  answeredQuestions: string[]
}

export interface PKRound {
  question: PKQuestion
  player1Answer?: string
  player2Answer?: string
  player1Correct: boolean
  player2Correct: boolean
  player1TimeMs?: number
  player2TimeMs?: number
}

export interface PKMatch {
  id: string
  player1: PKPlayer
  player2: PKPlayer
  rounds: PKRound[]
  totalRounds: number
  currentRound: number
  startTime: number
  endTime?: number
  winner?: 'player1' | 'player2' | 'draw'
  difficulty: PKDifficulty
}

export interface PKStats {
  totalMatches: number
  wins: number
  losses: number
  draws: number
  totalQuestions: number
  correctAnswers: number
  bestStreak: number
  avgAnswerTime: number
  favoriteCategory: PKQuestionType | null
}

const STATS_KEY = '@music_pk_stats_v1'
const HISTORY_KEY = '@music_pk_history_v1'
const MAX_HISTORY = 20

const DIFFICULTY_OPTIONS_COUNT: Record<PKDifficulty, number> = {
  easy: 4,
  normal: 4,
  hard: 3,
}

const DIFFICULTY_TIME_LIMIT: Record<PKDifficulty, number> = {
  easy: 30000,
  normal: 20000,
  hard: 10000,
}

/** 生成问题 */
export const generateQuestions = (
  songs: MusicInfo[],
  count: number,
  difficulty: PKDifficulty = 'normal',
): PKQuestion[] => {
  if (songs.length < 4) return []

  const questions: PKQuestion[] = []
  const usedSongs = new Set<string>()
  // 仅使用2种核心题型，避免重复（year_by_song 需要无的数据，lyric 类需要歌词）
  const types: PKQuestionType[] = ['song_by_artist', 'artist_by_song']

  for (let i = 0; i < count; i++) {
    let attempts = 0
    let song: MusicInfo | null = null
    while (attempts < 10) {
      const candidate = songs[Math.floor(Math.random() * songs.length)]
      if (!usedSongs.has(candidate.id)) {
        song = candidate
        usedSongs.add(candidate.id)
        break
      }
      attempts++
    }
    if (!song) {
      song = songs[Math.floor(Math.random() * songs.length)]
    }

    const type = types[Math.floor(Math.random() * types.length)]
    const q = buildQuestion(song, songs, type, difficulty, i)
    if (q) questions.push(q)
  }

  return questions
}

/** 构建单个问题 */
const buildQuestion = (
  song: MusicInfo,
  allSongs: MusicInfo[],
  type: PKQuestionType,
  difficulty: PKDifficulty,
  index: number,
): PKQuestion | null => {
  const optionsCount = DIFFICULTY_OPTIONS_COUNT[difficulty]
  const otherSongs = allSongs.filter((s) => s.id !== song.id)
  if (otherSongs.length < optionsCount - 1) return null

  const distractors = shuffle(otherSongs).slice(0, optionsCount - 1)
  let prompt = ''
  let correctAnswer = ''
  let options: string[] = []
  let hint: string | undefined

  switch (type) {
    case 'song_by_artist': {
      prompt = `以下哪首是 ${song.singer} 的歌曲？`
      correctAnswer = song.name
      options = shuffle([song.name, ...distractors.map((d) => d.name)])
      hint = `${song.singer}的作品`
      break
    }
    case 'artist_by_song': {
      prompt = `《${song.name}》是哪位歌手的作品？`
      correctAnswer = song.singer
      options = shuffle([song.singer, ...distractors.map((d) => d.singer)])
      hint = `演唱了《${song.name}》`
      break
    }
    case 'lyric_by_song':
    case 'song_by_lyric':
    case 'year_by_song': {
      // 这些题型需要歌词/年份数据，目前跳过
      return null
    }
  }

  return {
    id: `q_${index}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    type,
    difficulty,
    prompt,
    options,
    correctAnswer,
    hint,
    sourceSong: song,
  }
}

/** 创建新对局 */
export const createMatch = (
  player1Name: string,
  player2Name: string,
  songs: MusicInfo[],
  totalRounds: number = 10,
  difficulty: PKDifficulty = 'normal',
): PKMatch | null => {
  const questions = generateQuestions(songs, totalRounds, difficulty)
  if (questions.length === 0) return null

  const match: PKMatch = {
    id: `pk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    player1: {
      id: 'p1',
      name: player1Name,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      streak: 0,
      maxStreak: 0,
      answeredQuestions: [],
    },
    player2: {
      id: 'p2',
      name: player2Name,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      streak: 0,
      maxStreak: 0,
      answeredQuestions: [],
    },
    rounds: questions.map((q) => ({
      question: q,
      player1Correct: false,
      player2Correct: false,
    })),
    totalRounds: questions.length,
    currentRound: 0,
    startTime: Date.now(),
    difficulty,
  }
  return match
}

/** 答题 */
export const answerRound = (
  match: PKMatch,
  player: 'player1' | 'player2',
  answer: string,
  timeMs: number,
): { correct: boolean; gainedScore: number; isStreak: boolean } => {
  const round = match.rounds[match.currentRound]
  if (!round) return { correct: false, gainedScore: 0, isStreak: false }

  const correct = answer === round.question.correctAnswer
  const p = match[player]

  if (player === 'player1') {
    round.player1Answer = answer
    round.player1Correct = correct
    round.player1TimeMs = timeMs
  } else {
    round.player2Answer = answer
    round.player2Correct = correct
    round.player2TimeMs = timeMs
  }

  let gainedScore = 0
  if (correct) {
    p.correctCount++
    p.streak++
    p.maxStreak = Math.max(p.maxStreak, p.streak)
    // 基础分100 + 速度奖励 + 连击奖励
    const timeBonus = Math.max(0, Math.floor((DIFFICULTY_TIME_LIMIT[match.difficulty] - timeMs) / 100))
    const streakBonus = Math.min(50, p.streak * 10)
    const difficultyMultiplier = match.difficulty === 'hard' ? 1.5 : match.difficulty === 'normal' ? 1.2 : 1
    gainedScore = Math.floor((100 + timeBonus + streakBonus) * difficultyMultiplier)
    p.score += gainedScore
  } else {
    p.wrongCount++
    p.streak = 0
  }
  p.answeredQuestions.push(round.question.id)

  return { correct, gainedScore, isStreak: p.streak >= 3 }
}

/** 进入下一轮 */
export const nextRound = (match: PKMatch): boolean => {
  if (match.currentRound >= match.totalRounds - 1) {
    finishMatch(match)
    return false
  }
  match.currentRound++
  return true
}

/** 结束对局 */
export const finishMatch = (match: PKMatch): void => {
  match.endTime = Date.now()
  if (match.player1.score > match.player2.score) {
    match.winner = 'player1'
  } else if (match.player2.score > match.player1.score) {
    match.winner = 'player2'
  } else {
    match.winner = 'draw'
  }
}

/** 保存对局到历史 */
export const saveMatchToHistory = async (match: PKMatch): Promise<void> => {
  const history = await getMatchHistory()
  history.unshift(match)
  await saveData(HISTORY_KEY, history.slice(0, MAX_HISTORY))

  // 更新统计
  await updateStats(match)
  addDevLog('info', 'MusicPK', `对局结束: ${match.player1.name} vs ${match.player2.name}, 胜者=${match.winner}`)
}

/** 获取对局历史 */
export const getMatchHistory = async (): Promise<PKMatch[]> => {
  const data = await getData<PKMatch[]>(HISTORY_KEY)
  return data || []
}

/** 更新统计 */
const updateStats = async (match: PKMatch): Promise<void> => {
  const stats = await getStats()
  stats.totalMatches++
  if (match.winner === 'player1') stats.wins++
  else if (match.winner === 'player2') stats.losses++
  else stats.draws++

  stats.totalQuestions += match.totalRounds * 2 // 双方各答一次
  stats.correctAnswers += match.player1.correctCount + match.player2.correctCount
  stats.bestStreak = Math.max(stats.bestStreak, match.player1.maxStreak, match.player2.maxStreak)

  // 平均答题时间
  const times: number[] = []
  for (const r of match.rounds) {
    if (r.player1TimeMs) times.push(r.player1TimeMs)
    if (r.player2TimeMs) times.push(r.player2TimeMs)
  }
  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    stats.avgAnswerTime = stats.avgAnswerTime === 0 ? avg : (stats.avgAnswerTime + avg) / 2
  }

  await saveData(STATS_KEY, stats)
}

/** 获取统计 */
export const getStats = async (): Promise<PKStats> => {
  const data = await getData<PKStats>(STATS_KEY)
  return data || {
    totalMatches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    bestStreak: 0,
    avgAnswerTime: 0,
    favoriteCategory: null,
  }
}

/** 重置统计 */
export const resetStats = async (): Promise<void> => {
  await saveData(STATS_KEY, null)
  addDevLog('info', 'MusicPK', '统计已重置')
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

/** 获取难度名 */
export const getDifficultyName = (d: PKDifficulty): string => {
  const map: Record<PKDifficulty, string> = { easy: '简单', normal: '普通', hard: '困难' }
  return map[d]
}

/** 获取所有难度 */
export const getAllDifficulties = (): Array<{ key: PKDifficulty; name: string; desc: string }> => [
  { key: 'easy', name: '简单', desc: '4选项，30秒答题' },
  { key: 'normal', name: '普通', desc: '4选项，20秒答题' },
  { key: 'hard', name: '困难', desc: '3选项，10秒答题' },
]

/** 计算胜率 */
export const getWinRate = (stats: PKStats): number => {
  if (stats.totalMatches === 0) return 0
  return Math.round((stats.wins / stats.totalMatches) * 100)
}

/** 计算正确率 */
export const getAccuracy = (stats: PKStats): number => {
  if (stats.totalQuestions === 0) return 0
  return Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
}

/** 生成对局结果文本 */
export const generateMatchReport = (match: PKMatch): string => {
  let text = `🎮 音乐PK对战结果\n\n`
  text += `👥 ${match.player1.name} vs ${match.player2.name}\n`
  text += `🏆 胜者: ${match.winner === 'draw' ? '平局' : match.winner === 'player1' ? match.player1.name : match.player2.name}\n\n`
  text += `📊 比分:\n`
  text += `  ${match.player1.name}: ${match.player1.score}分 (${match.player1.correctCount}对${match.player1.wrongCount}错, 最长${match.player1.maxStreak}连击)\n`
  text += `  ${match.player2.name}: ${match.player2.score}分 (${match.player2.correctCount}对${match.player2.wrongCount}错, 最长${match.player2.maxStreak}连击)\n\n`
  text += `📝 共${match.totalRounds}轮, 难度${getDifficultyName(match.difficulty)}\n`
  if (match.endTime) {
    const duration = Math.floor((match.endTime - match.startTime) / 1000)
    text += `⏱️ 总耗时: ${duration}秒\n`
  }
  return text
}
