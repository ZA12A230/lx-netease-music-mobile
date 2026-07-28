/**
 * 音乐知识问答游戏
 * 基于用户歌单生成问答题
 */
import listState from '@/store/list/state'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export type QuizType =
  | 'song_by_lyric'    // 根据歌词猜歌名
  | 'artist_by_song'   // 根据歌名猜歌手
  | 'release_year'     // 猜发行年份
  | 'next_lyric'       // 接下一句歌词
  | 'song_order'       // 歌曲排序
  | 'cover_recognize'  // 封面识别
  | 'genre_guess'      // 流派猜测
  | 'lyric_complete'   // 歌词填空

export interface QuizQuestion {
  id: string
  type: QuizType
  question: string
  options: string[]
  correctAnswer: number // 选项索引
  explanation?: string
  difficulty: 'easy' | 'medium' | 'hard'
  songInfo?: { name: string; singer: string }
  points: number
}

export interface QuizSession {
  id: string
  startedAt: number
  endedAt: number
  totalQuestions: number
  correctAnswers: number
  wrongAnswers: number
  score: number
  questions: Array<{ question: QuizQuestion; userAnswer: number; correct: boolean }>
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
}

export interface QuizStats {
  totalSessions: number
  totalQuestions: number
  totalCorrect: number
  totalScore: number
  averageScore: number
  bestScore: number
  currentStreak: number
  longestStreak: number
  typeStats: Record<QuizType, { total: number; correct: number }>
}

const SESSIONS_KEY = '@quiz_sessions_v1'
const STATS_KEY = '@quiz_stats_v1'

/** 生成问答题 */
export const generateQuestions = async (
  count = 10,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed',
): Promise<QuizQuestion[]> => {
  // 从用户歌单随机选择歌曲
  const allSongs = listState.allList.flatMap((l) => l.list)
  if (allSongs.length < 4) {
    addDevLog('warn', 'MusicQuiz', '歌曲数量不足，至少需要4首')
    return []
  }

  const questions: QuizQuestion[] = []
  const types: QuizType[] = ['song_by_lyric', 'artist_by_song', 'next_lyric', 'lyric_complete']
  const targetTypes = difficulty === 'mixed' ? types : types

  for (let i = 0; i < count; i++) {
    const type = targetTypes[i % targetTypes.length]
    const question = await generateSingleQuestion(type, allSongs, difficulty)
    if (question) questions.push(question)
  }

  addDevLog('info', 'MusicQuiz', `生成${questions.length}道问答题`)
  return questions
}

/** 生成单道题 */
const generateSingleQuestion = async (
  type: QuizType,
  songs: MusicInfo[],
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
): Promise<QuizQuestion | null> => {
  // 随机选择4首歌曲作为选项
  const shuffled = [...songs].sort(() => Math.random() - 0.5)
  const correct = shuffled[0]
  const options = shuffled.slice(0, 4).map((s) => s.name)

  const diff: 'easy' | 'medium' | 'hard' = difficulty === 'mixed'
    ? (['easy', 'medium', 'hard'] as const)[Math.floor(Math.random() * 3)]
    : difficulty

  const question: QuizQuestion = {
    id: `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    question: '',
    options: shuffleArray(options),
    correctAnswer: 0,
    difficulty: diff,
    songInfo: { name: correct.name, singer: correct.singer },
    points: diff === 'easy' ? 10 : diff === 'medium' ? 20 : 30,
  }

  switch (type) {
    case 'artist_by_song':
      question.question = `《${correct.name}》是哪位歌手演唱的？`
      question.options = shuffleArray(shuffled.slice(0, 4).map((s) => s.singer))
      question.correctAnswer = question.options.indexOf(correct.singer)
      question.explanation = `《${correct.name}》由 ${correct.singer} 演唱`
      break

    case 'song_by_lyric':
      // 简化：使用歌名作为提示
      question.question = `以下哪首歌的歌名包含"${correct.name.charAt(0)}"字？`
      question.correctAnswer = question.options.indexOf(correct.name)
      question.explanation = `《${correct.name}》- ${correct.singer}`
      break

    case 'lyric_complete':
      question.question = `《${correct.name}》的歌手是谁？`
      question.options = shuffleArray(shuffled.slice(0, 4).map((s) => s.singer))
      question.correctAnswer = question.options.indexOf(correct.singer)
      question.explanation = `《${correct.name}》由 ${correct.singer} 演唱`
      break

    case 'next_lyric':
      question.question = `《${correct.name}》是哪位歌手的作品？`
      question.options = shuffleArray(shuffled.slice(0, 4).map((s) => s.singer))
      question.correctAnswer = question.options.indexOf(correct.singer)
      question.explanation = `正确答案是 ${correct.singer}`
      break

    default:
      return null
  }

  // 确保正确答案在选项中
  if (question.correctAnswer < 0 || question.correctAnswer >= question.options.length) {
    return null
  }

  return question
}

const shuffleArray = <T>(arr: T[]): T[] => {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** 开始问答会话 */
export const startQuizSession = async (
  questionCount = 10,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed',
): Promise<{ session: QuizSession; questions: QuizQuestion[] } | null> => {
  const questions = await generateQuestions(questionCount, difficulty)
  if (questions.length === 0) return null

  const session: QuizSession = {
    id: `quiz_session_${Date.now()}`,
    startedAt: Date.now(),
    endedAt: 0,
    totalQuestions: questions.length,
    correctAnswers: 0,
    wrongAnswers: 0,
    score: 0,
    questions: [],
    difficulty,
  }

  return { session, questions }
}

/** 回答问题 */
export const answerQuestion = (
  session: QuizSession,
  question: QuizQuestion,
  answerIndex: number,
): { correct: boolean; correctAnswer: number; explanation?: string } => {
  const correct = answerIndex === question.correctAnswer
  session.questions.push({
    question,
    userAnswer: answerIndex,
    correct,
  })

  if (correct) {
    session.correctAnswers++
    session.score += question.points
  } else {
    session.wrongAnswers++
  }

  return {
    correct,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
  }
}

/** 结束问答会话 */
export const endQuizSession = async (session: QuizSession): Promise<QuizSession> => {
  session.endedAt = Date.now()

  // 保存会话
  const sessions = await getAllSessions()
  sessions.unshift(session)
  await saveData(SESSIONS_KEY, sessions.slice(0, 100))

  // 更新统计
  await updateStats(session)

  addDevLog('info', 'MusicQuiz', `问答结束: ${session.correctAnswers}/${session.totalQuestions}正确, 得分${session.score}`)
  return session
}

/** 获取所有问答会话 */
export const getAllSessions = async (): Promise<QuizSession[]> => {
  const data = await getData<QuizSession[]>(SESSIONS_KEY)
  return data || []
}

/** 更新统计 */
const updateStats = async (session: QuizSession) => {
  const stats = await getStats()
  stats.totalSessions++
  stats.totalQuestions += session.totalQuestions
  stats.totalCorrect += session.correctAnswers
  stats.totalScore += session.score
  stats.averageScore = stats.totalScore / stats.totalSessions
  stats.bestScore = Math.max(stats.bestScore, session.score)

  // 连续答对统计
  let currentStreak = 0
  for (const q of session.questions) {
    if (q.correct) {
      currentStreak++
      stats.longestStreak = Math.max(stats.longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  // 类型统计
  for (const q of session.questions) {
    if (!stats.typeStats[q.question.type]) {
      stats.typeStats[q.question.type] = { total: 0, correct: 0 }
    }
    stats.typeStats[q.question.type].total++
    if (q.correct) stats.typeStats[q.question.type].correct++
  }

  await saveData(STATS_KEY, stats)
}

/** 获取统计 */
export const getStats = async (): Promise<QuizStats> => {
  const data = await getData<QuizStats>(STATS_KEY)
  return data || {
    totalSessions: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    totalScore: 0,
    averageScore: 0,
    bestScore: 0,
    currentStreak: 0,
    longestStreak: 0,
    typeStats: {} as Record<QuizType, { total: number; correct: number }>,
  }
}

/** 获取问答类型描述 */
export const getQuizTypeDescription = (type: QuizType): { name: string; icon: string } => {
  const descriptions: Record<QuizType, { name: string; icon: string }> = {
    song_by_lyric: { name: '看词猜歌', icon: '📝' },
    artist_by_song: { name: '看歌猜手', icon: '🎤' },
    release_year: { name: '猜发行年份', icon: '📅' },
    next_lyric: { name: '接歌词', icon: '🎵' },
    song_order: { name: '歌曲排序', icon: '📋' },
    cover_recognize: { name: '封面识别', icon: '🖼️' },
    genre_guess: { name: '流派猜测', icon: '🎶' },
    lyric_complete: { name: '歌词填空', icon: '✏️' },
  }
  return descriptions[type]
}

/** 获取难度描述 */
export const getDifficultyDescription = (difficulty: string): { name: string; color: string; multiplier: number } => {
  switch (difficulty) {
    case 'easy': return { name: '简单', color: '#4CAF50', multiplier: 1 }
    case 'medium': return { name: '中等', color: '#FF9800', multiplier: 2 }
    case 'hard': return { name: '困难', color: '#F44336', multiplier: 3 }
    default: return { name: '混合', color: '#9C27B0', multiplier: 1.5 }
  }
}

/** 获取排行榜 */
export const getLeaderboard = async (topN = 10): Promise<Array<{ score: number; date: number; accuracy: number }>> => {
  const sessions = await getAllSessions()
  return sessions
    .map((s) => ({
      score: s.score,
      date: s.startedAt,
      accuracy: s.totalQuestions > 0 ? s.correctAnswers / s.totalQuestions : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}
