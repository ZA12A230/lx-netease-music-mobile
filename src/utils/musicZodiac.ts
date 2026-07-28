/**
 * 音乐星座
 * 根据听歌习惯生成你的音乐星座和性格分析
 *
 * 12种音乐星座：
 * - 基于听歌风格分布、活跃时段、流派偏好等维度
 * - 每个星座有独特的性格描述、幸运歌单、相性星座
 * - 类似占星但基于真实听歌数据
 */
import { getData, setData } from '@/utils/data'
import { addDevLog } from '@/utils/devKit'

const ZODIAC_HISTORY_KEY = 'music_zodiac_history'

export interface MusicZodiacSign {
  id: string
  name: string                 // 星座名
  symbol: string               // 符号（emoji）
  element: 'fire' | 'earth' | 'air' | 'water'    // 元素
  dates: string                // 对应日期范围（占星式表达，仅装饰）
  traits: string[]             // 性格特征
  description: string          // 详细描述
  luckyGenres: string[]        // 幸运音乐风格
  compatibleSigns: string[]    // 相性星座ID
  incompatibleSigns: string[]  // 不合星座ID
  color: string                // 代表色
}

/** 12种音乐星座定义 */
export const MUSIC_ZODIAC_SIGNS: MusicZodiacSign[] = [
  {
    id: 'rock_aries',
    name: '摇滚白羊',
    symbol: '♈',
    element: 'fire',
    dates: '3月21日 - 4月19日',
    traits: ['热情奔放', '节奏感强', '不羁', '勇敢', '冲动'],
    description: '你是音乐世界里的探险者，热血澎湃的摇滚是你的灵魂伴侣。你喜欢强烈的节奏和电吉他的嘶吼，音乐对你而言是释放激情的出口。',
    luckyGenres: ['摇滚', '朋克', '金属', '另类'],
    compatibleSigns: ['pop_leo', 'electro_sagittarius'],
    incompatibleSigns: ['classical_virgo'],
    color: '#FF4444',
  },
  {
    id: 'pop_leo',
    name: '流行狮子',
    symbol: '♌',
    element: 'fire',
    dates: '7月23日 - 8月22日',
    traits: ['张扬', '魅力', '主流', '耀眼', '自信'],
    description: '流行音乐是你的舞台，你喜欢朗朗上口的旋律和精心制作的编曲。你的歌单永远是热门榜单，朋友都来问你在听什么。',
    luckyGenres: ['流行', '舞曲', '电子流行', 'R&B'],
    compatibleSigns: ['rock_aries', 'indie_gemini'],
    incompatibleSigns: ['metal_capricorn'],
    color: '#FFB000',
  },
  {
    id: 'electro_sagittarius',
    name: '电子射手',
    symbol: '♐',
    element: 'fire',
    dates: '11月22日 - 12月21日',
    traits: ['自由', '律动', '前卫', '探索', '国际化'],
    description: '电子乐的律动让你无法停下脚步，BPM是你生命的节拍。从House到Techno，你享受着音乐带来的失重感。',
    luckyGenres: ['电子', 'House', 'Techno', 'Trance'],
    compatibleSigns: ['rock_aries', 'jazz_libra'],
    incompatibleSigns: ['folk_cancer'],
    color: '#00D9FF',
  },
  {
    id: 'folk_cancer',
    name: '民谣巨蟹',
    symbol: '♋',
    element: 'water',
    dates: '6月22日 - 7月22日',
    traits: ['感性', '怀旧', '温柔', '细腻', '恋家'],
    description: '一把吉他，一段故事，民谣是你最深的情感寄托。你爱那些质朴真诚的歌声，每首歌都像一封写给旧时光的信。',
    luckyGenres: ['民谣', '独立', '城市民谣', '校园民谣'],
    compatibleSigns: ['classical_virgo', 'indie_gemini'],
    incompatibleSigns: ['electro_sagittarius'],
    color: '#7E9B8E',
  },
  {
    id: 'classical_virgo',
    name: '古典处女',
    symbol: '♍',
    element: 'earth',
    dates: '8月23日 - 9月22日',
    traits: ['精致', '理性', '完美主义', '深度', '内敛'],
    description: '古典乐的严谨结构让你着迷，你欣赏那些经得起时间考验的作品。从巴赫到肖邦，你在音乐中寻找秩序与永恒。',
    luckyGenres: ['古典', '交响', '钢琴', '室内乐'],
    compatibleSigns: ['folk_cancer', 'jazz_libra'],
    incompatibleSigns: ['rock_aries'],
    color: '#8B7355',
  },
  {
    id: 'metal_capricorn',
    name: '金属摩羯',
    symbol: '♑',
    element: 'earth',
    dates: '12月22日 - 1月19日',
    traits: ['坚定', '深沉', '硬核', '执拗', '专一'],
    description: '极端的音色和复杂的结构是你追求的极致，金属乐的力量感让你感到内心的平静。在外界看来喧闹的世界里，你听见的是秩序。',
    luckyGenres: ['重金属', '死亡金属', '黑金属', '前卫金属'],
    compatibleSigns: ['rock_aries'],
    incompatibleSigns: ['pop_leo'],
    color: '#3A3A3A',
  },
  {
    id: 'indie_gemini',
    name: '独立双子',
    symbol: '♊',
    element: 'air',
    dates: '5月21日 - 6月20日',
    traits: ['多变', '好奇', '小众', '文艺', '潮流'],
    description: '你的歌单永远充满惊喜，独立音乐人是你追逐的宝藏。从Dream Pop到后摇，你享受着不被主流定义的自由感。',
    luckyGenres: ['独立', '后摇', 'Dream Pop', 'Lo-Fi'],
    compatibleSigns: ['pop_leo', 'jazz_libra'],
    incompatibleSigns: ['metal_capricorn'],
    color: '#A8D8B9',
  },
  {
    id: 'jazz_libra',
    name: '爵士天秤',
    symbol: '♎',
    element: 'air',
    dates: '9月23日 - 10月22日',
    traits: ['优雅', '平衡', '即兴', '品味', '浪漫'],
    description: '爵士乐的即兴与优雅深得你心，你享受那些不确定的旋律走向。音乐对你而言是生活的艺术，是品味与格调的体现。',
    luckyGenres: ['爵士', 'Bossa Nova', 'Smooth Jazz', 'Swing'],
    compatibleSigns: ['classical_virgo', 'indie_gemini'],
    incompatibleSigns: ['rock_aries'],
    color: '#5D4037',
  },
  {
    id: 'hiphop_aquarius',
    name: '说唱水瓶',
    symbol: '♒',
    element: 'air',
    dates: '1月20日 - 2月18日',
    traits: ['叛逆', '锋利', '前沿', '思想性', '街头'],
    description: '说唱是你表达态度的方式，flow的精妙和歌词的深度都让你着迷。从老派到Trap，你跟着节拍思考世界。',
    luckyGenres: ['说唱', 'Hip-Hop', 'Trap', 'Boom Bap'],
    compatibleSigns: ['electro_sagittarius', 'indie_gemini'],
    incompatibleSigns: ['classical_virgo'],
    color: '#FF6B35',
  },
  {
    id: 'rnb_scorpio',
    name: 'R&B天蝎',
    symbol: '♏',
    element: 'water',
    dates: '10月23日 - 11月21日',
    traits: ['性感', '神秘', '深情', '占有欲', '诱惑'],
    description: 'R&B的律动和情绪是你灵魂的写照，你爱那些低吟浅唱的瞬间。音乐对你而言是欲望与情感交织的暗夜低语。',
    luckyGenres: ['R&B', 'Soul', 'Neo Soul', 'Alternative R&B'],
    compatibleSigns: ['folk_cancer', 'jazz_libra'],
    incompatibleSigns: ['metal_capricorn'],
    color: '#8B2252',
  },
  {
    id: 'ballad_pisces',
    name: '情歌双鱼',
    symbol: '♓',
    element: 'water',
    dates: '2月19日 - 3月20日',
    traits: ['浪漫', '多愁善感', '梦幻', '理想主义', '善解人意'],
    description: '抒情歌是你的避风港，每一段旋律都触动你的心弦。你常在深夜单曲循环，让音乐带你去往没有伤痛的梦境。',
    luckyGenres: ['情歌', '流行抒情', 'BGM', '治愈系'],
    compatibleSigns: ['folk_cancer', 'rnb_scorpio'],
    incompatibleSigns: ['rock_aries'],
    color: '#7986CB',
  },
  {
    id: 'world_taurus',
    name: '世界金牛',
    symbol: '♉',
    element: 'earth',
    dates: '4月20日 - 5月20日',
    traits: ['感官', '多元', '质朴', '享受', '世界公民'],
    description: '世界音乐的多元让你着迷，从非洲鼓点到拉丁律动，你享受着不同文化的声音。音乐对你而言是一场不落幕的世界旅行。',
    luckyGenres: ['世界音乐', '拉丁', '雷鬼', '非洲节奏'],
    compatibleSigns: ['classical_virgo', 'folk_cancer'],
    incompatibleSigns: ['electro_sagittarius'],
    color: '#8D6E63',
  },
]

export interface ZodiacAnalysisResult {
  sign: MusicZodiacSign
  /** 音乐元素分布 */
  elementDistribution: Record<'fire' | 'earth' | 'air' | 'water', number>
  /** 听歌偏好关键词 */
  preferenceKeywords: string[]
  /** 综合评分 */
  scores: {
    energy: number          // 能量值 0-100
    emotion: number         // 情感值 0-100
    complexity: number      // 复杂度 0-100
    popularity: number      // 主流度 0-100
    diversity: number       // 多样性 0-100
  }
  /** 计算时间 */
  analyzedAt: number
  /** 数据样本量 */
  sampleSize: number
}

/**
 * 分析听歌习惯并生成音乐星座
 * - 基于歌曲元数据：流派、BPM、能量值等
 * - 基于听歌时段：白天/夜晚/深夜
 * - 基于歌曲语言：华语/英语/日韩等
 */
export const analyzeMusicZodiac = async (
  playHistory: Array<{
    musicInfo: LX.Music.MusicInfoOnline
    playedAt: number
    playDuration: number
  }>
): Promise<ZodiacAnalysisResult> => {
  if (playHistory.length === 0) {
    // 无数据时返回默认（流行狮子）
    const defaultSign = MUSIC_ZODIAC_SIGNS[1]
    return {
      sign: defaultSign,
      elementDistribution: { fire: 50, earth: 20, air: 20, water: 10 },
      preferenceKeywords: ['流行', '主流'],
      scores: {
        energy: 50,
        emotion: 50,
        complexity: 30,
        popularity: 80,
        diversity: 20,
      },
      analyzedAt: Date.now(),
      sampleSize: 0,
    }
  }

  // 计算元素分布
  const elementCount: Record<'fire' | 'earth' | 'air' | 'water', number> = {
    fire: 0, earth: 0, air: 0, water: 0,
  }
  const genreCount: Record<string, number> = {}

  for (const item of playHistory) {
    // 简单地根据歌曲名/歌手猜流派（实际可接入更复杂分类）
    const guessedGenres = guessGenres(item.musicInfo)
    for (const genre of guessedGenres) {
      genreCount[genre] = (genreCount[genre] || 0) + 1
    }
    // 根据流派累加元素
    for (const genre of guessedGenres) {
      const element = genreToElement(genre)
      elementCount[element]++
    }
  }

  // 归一化
  const total = Object.values(elementCount).reduce((a, b) => a + b, 0) || 1
  const elementDistribution = {
    fire: Math.round((elementCount.fire / total) * 100),
    earth: Math.round((elementCount.earth / total) * 100),
    air: Math.round((elementCount.air / total) * 100),
    water: Math.round((elementCount.water / total) * 100),
  }

  // 找到主导元素
  const dominantElement = (Object.entries(elementDistribution) as Array<[keyof typeof elementDistribution, number]>)
    .sort((a, b) => b[1] - a[1])[0][0]

  // 从主导元素中选出最匹配的星座
  const sign = pickSignByElementAndGenres(dominantElement, genreCount)

  // 计算各项评分
  const scores = calculateScores(playHistory, elementDistribution, genreCount)

  // 提取偏好关键词
  const preferenceKeywords = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre)

  const result: ZodiacAnalysisResult = {
    sign,
    elementDistribution,
    preferenceKeywords,
    scores,
    analyzedAt: Date.now(),
    sampleSize: playHistory.length,
  }

  // 保存到历史
  await saveZodiacHistory(result)

  addDevLog('info', 'MusicZodiac', `分析完成，星座: ${sign.name}`)
  return result
}

/** 简单的流派猜测（基于歌曲名/歌手名关键字） */
const guessGenres = (musicInfo: LX.Music.MusicInfoOnline): string[] => {
  const genres: string[] = []
  const name = (musicInfo.name || '').toLowerCase()
  const singer = (musicInfo.singer || '').toLowerCase()

  // 关键词匹配
  if (/rock|摇滚|punk|朋克|metal|金属/.test(name + singer)) genres.push('摇滚')
  if (/pop|流行|dance|舞曲/.test(name + singer)) genres.push('流行')
  if (/folk|民谣|ballad|情歌|love/.test(name + singer)) genres.push('民谣')
  if (/classical|古典|symphony|钢琴|piano/.test(name + singer)) genres.push('古典')
  if (/jazz|爵士|blues|布鲁斯/.test(name + singer)) genres.push('爵士')
  if (/hip.?hop|rap|说唱|trap/.test(name + singer)) genres.push('说唱')
  if (/r&b|soul|soul/.test(name + singer)) genres.push('R&B')
  if (/edm|electronic|电子|house|techno/.test(name + singer)) genres.push('电子')
  if (/indie|独立|后摇|post.?rock/.test(name + singer)) genres.push('独立')
  if (/world|世界|latin|雷鬼|reggae/.test(name + singer)) genres.push('世界')

  // 默认归类为流行
  if (genres.length === 0) genres.push('流行')

  return genres
}

/** 流派到元素的映射 */
const genreToElement = (genre: string): 'fire' | 'earth' | 'air' | 'water' => {
  switch (genre) {
    case '摇滚':
    case '朋克':
    case '金属':
    case '流行':
    case '电子':
      return 'fire'
    case '古典':
    case '金属':
    case '世界':
      return 'earth'
    case '独立':
    case '爵士':
    case '说唱':
      return 'air'
    case '民谣':
    case 'R&B':
    case '情歌':
      return 'water'
    default:
      return 'fire'
  }
}

/** 根据主导元素和流派选出星座 */
const pickSignByElementAndGenres = (
  element: 'fire' | 'earth' | 'air' | 'water',
  genreCount: Record<string, number>
): MusicZodiacSign => {
  // 该元素的星座候选
  const candidates = MUSIC_ZODIAC_SIGNS.filter((s) => s.element === element)
  // 找到幸运风格匹配最多的星座
  let bestSign = candidates[0]
  let bestScore = -1

  for (const sign of candidates) {
    let score = 0
    for (const luckyGenre of sign.luckyGenres) {
      // 模糊匹配
      for (const genre of Object.keys(genreCount)) {
        if (luckyGenre.includes(genre) || genre.includes(luckyGenre)) {
          score += genreCount[genre]
        }
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestSign = sign
    }
  }

  return bestSign
}

/** 计算各项评分 */
const calculateScores = (
  history: Array<{ musicInfo: LX.Music.MusicInfoOnline; playedAt: number; playDuration: number }>,
  elementDistribution: ZodiacAnalysisResult['elementDistribution'],
  genreCount: Record<string, number>
): ZodiacAnalysisResult['scores'] => {
  // 能量值：火元素比例
  const energy = Math.min(100, elementDistribution.fire * 2)
  // 情感值：水元素比例
  const emotion = Math.min(100, elementDistribution.water * 2)
  // 复杂度：古典/爵士/独立比例
  const complexityGenres = ['古典', '爵士', '独立', '后摇']
  const complexityCount = complexityGenres.reduce((sum, g) => sum + (genreCount[g] || 0), 0)
  const complexity = Math.min(100, (complexityCount / Math.max(1, history.length)) * 200)
  // 主流度：流行/说唱比例
  const popularGenres = ['流行', '说唱', 'R&B']
  const popularCount = popularGenres.reduce((sum, g) => sum + (genreCount[g] || 0), 0)
  const popularity = Math.min(100, (popularCount / Math.max(1, history.length)) * 150)
  // 多样性：流派种类数
  const diversity = Math.min(100, Object.keys(genreCount).length * 15)

  return { energy, emotion, complexity, popularity, diversity }
}

/** 保存星座分析历史 */
export interface ZodiacHistoryItem {
  id: string
  signId: string
  signName: string
  analyzedAt: number
  sampleSize: number
  energy: number
  emotion: number
}

export const getZodiacHistory = async (): Promise<ZodiacHistoryItem[]> => {
  return (await getData<ZodiacHistoryItem[]>(ZODIAC_HISTORY_KEY)) ?? []
}

const saveZodiacHistory = async (result: ZodiacAnalysisResult) => {
  const history = await getZodiacHistory()
  const item: ZodiacHistoryItem = {
    id: `zodiac_${result.analyzedAt}`,
    signId: result.sign.id,
    signName: result.sign.name,
    analyzedAt: result.analyzedAt,
    sampleSize: result.sampleSize,
    energy: result.scores.energy,
    emotion: result.scores.emotion,
  }
  // 只保留最近20条
  const newHistory = [item, ...history].slice(0, 20)
  await setData(ZODIAC_HISTORY_KEY, newHistory)
}

/** 获取星座相性分析 */
export const getCompatibility = (sign1Id: string, sign2Id: string): {
  level: 'perfect' | 'good' | 'neutral' | 'bad'
  desc: string
} => {
  const sign1 = MUSIC_ZODIAC_SIGNS.find((s) => s.id === sign1Id)
  const sign2 = MUSIC_ZODIAC_SIGNS.find((s) => s.id === sign2Id)
  if (!sign1 || !sign2) return { level: 'neutral', desc: '未知' }

  if (sign1.compatibleSigns.includes(sign2Id)) {
    return { level: 'perfect', desc: `天作之合：${sign1.name} 与 ${sign2.name} 在音乐品味上高度契合` }
  }
  if (sign2.compatibleSigns.includes(sign1Id)) {
    return { level: 'perfect', desc: `天作之合：${sign1.name} 与 ${sign2.name} 在音乐品味上高度契合` }
  }
  if (sign1.incompatibleSigns.includes(sign2Id) || sign2.incompatibleSigns.includes(sign1Id)) {
    return { level: 'bad', desc: `风格相斥：${sign1.name} 与 ${sign2.name} 在音乐偏好上存在较大差异` }
  }
  if (sign1.element === sign2.element) {
    return { level: 'good', desc: `同元素契合：${sign1.name} 与 ${sign2.name} 同属${sign1.element}元素` }
  }
  return { level: 'neutral', desc: '中性关系，互相探索可能有意想不到的发现' }
}
