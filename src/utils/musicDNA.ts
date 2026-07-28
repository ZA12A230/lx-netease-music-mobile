/**
 * 音乐DNA分析
 * 分析用户的音乐品味特征，生成独特的音乐DNA图谱
 */
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'
type MusicInfo = LX.Music.MusicInfo

export interface DNAChromosome {
  /** 特征维度 */
  trait: 'energy' | 'complexity' | 'mainstream' | 'diversity' | 'nostalgia' | 'emotion' | 'rhythm' | 'acoustic'
  /** 数值 0-100 */
  value: number
  /** 该维度的描述 */
  description: string
}

export interface MusicDNA {
  /** 唯一标识 */
  id: string
  /** 染色体（特征维度） */
  chromosomes: DNAChromosome[]
  /** 音乐指纹（哈希值，唯一标识用户品味） */
  fingerprint: string
  /** 主导特征 */
  dominantTraits: string[]
  /** 音乐类型 */
  personalityType: string
  /** 描述文本 */
  description: string
  /** 生成时间 */
  timestamp: number
}

const DNA_KEY = '@music_dna_v1'

const TRAIT_DESCRIPTIONS: Record<DNAChromosome['trait'], (value: number) => string> = {
  energy: (v) => v > 70 ? '高能量偏好，喜欢充满活力的音乐' : v > 40 ? '能量均衡，能接受各种节奏' : '偏爱低能量、舒缓的音乐',
  complexity: (v) => v > 70 ? '喜欢复杂编曲和实验性音乐' : v > 40 ? '接受适度复杂的音乐结构' : '偏好简洁明了的流行曲式',
  mainstream: (v) => v > 70 ? '紧跟主流，喜欢热门金曲' : v > 40 ? '主流与独立兼收并蓄' : '偏好独立小众音乐',
  diversity: (v) => v > 70 ? '音乐口味极为广泛，跨越多种风格' : v > 40 ? '有一定的风格跨度' : '专注少数几种风格',
  nostalgia: (v) => v > 70 ? '怀旧情结重，偏爱经典老歌' : v > 40 ? '新老歌曲兼收' : '紧跟新时代音乐',
  emotion: (v) => v > 70 ? '情感丰富，偏爱抒情歌曲' : v > 40 ? '情感表达适度' : '偏好理性、克制的音乐',
  rhythm: (v) => v > 70 ? '节奏感强，喜欢律动感强的音乐' : v > 40 ? '节奏接受度适中' : '不太关注节奏，更重旋律',
  acoustic: (v) => v > 70 ? '偏爱原声乐器' : v > 40 ? '原声电子兼收' : '偏好电子音乐',
}

const PERSONALITY_TYPES = [
  { type: '探索者', traits: ['diversity', 'complexity'], desc: '勇于尝试新音乐，品味广泛而深入' },
  { type: '怀旧者', traits: ['nostalgia', 'emotion'], desc: '珍视经典，情感细腻丰富' },
  { type: '活力派', traits: ['energy', 'rhythm'], desc: '充满活力，热爱节奏感强的音乐' },
  { type: '独立派', traits: ['mainstream', 'complexity'], desc: '不随波逐流，品味独特' },
  { type: '感性派', traits: ['emotion', 'acoustic'], desc: '感性细腻，偏爱原声抒情' },
  { type: '潮流派', traits: ['mainstream', 'energy'], desc: '紧跟潮流，热爱流行音乐' },
  { type: '深思者', traits: ['complexity', 'nostalgia'], desc: '思考深入，欣赏有内涵的音乐' },
  { type: '均衡者', traits: [], desc: '音乐品味均衡，兼容并蓄' },
]

/** 分析音乐DNA */
export const analyzeDNA = async (songs: MusicInfo[]): Promise<MusicDNA> => {
  if (songs.length === 0) {
    return createEmptyDNA()
  }

  const chromosomes: DNAChromosome[] = [
    { trait: 'energy', value: calculateEnergy(songs), description: '' },
    { trait: 'complexity', value: calculateComplexity(songs), description: '' },
    { trait: 'mainstream', value: calculateMainstream(songs), description: '' },
    { trait: 'diversity', value: calculateDiversity(songs), description: '' },
    { trait: 'nostalgia', value: calculateNostalgia(songs), description: '' },
    { trait: 'emotion', value: calculateEmotion(songs), description: '' },
    { trait: 'rhythm', value: calculateRhythm(songs), description: '' },
    { trait: 'acoustic', value: calculateAcoustic(songs), description: '' },
  ]

  // 填充描述
  for (const c of chromosomes) {
    c.description = TRAIT_DESCRIPTIONS[c.trait](c.value)
  }

  // 确定主导特征
  const sorted = [...chromosomes].sort((a, b) => b.value - a.value)
  const dominantTraits = sorted.slice(0, 3).map((c) => c.trait)

  // 匹配人格类型
  const personalityType = matchPersonalityType(dominantTraits)
  const personalityDesc = PERSONALITY_TYPES.find((p) => p.type === personalityType)?.desc || ''

  // 生成指纹
  const fingerprint = generateFingerprint(chromosomes)

  const dna: MusicDNA = {
    id: `dna_${Date.now()}`,
    chromosomes,
    fingerprint,
    dominantTraits,
    personalityType,
    description: personalityDesc,
    timestamp: Date.now(),
  }

  await saveData(DNA_KEY, dna)
  addDevLog('info', 'MusicDNA', `分析完成: ${personalityType}, 指纹=${fingerprint}`)
  return dna
}

const createEmptyDNA = (): MusicDNA => ({
  id: 'dna_empty',
  chromosomes: [],
  fingerprint: '00000000',
  dominantTraits: [],
  personalityType: '均衡者',
  description: '数据不足，无法分析',
  timestamp: Date.now(),
})

const matchPersonalityType = (dominant: string[]): string => {
  for (const p of PERSONALITY_TYPES) {
    if (p.traits.length === 0) continue
    const matchCount = p.traits.filter((t) => dominant.includes(t)).length
    if (matchCount === p.traits.length) return p.type
  }
  return '均衡者'
}

const generateFingerprint = (chromosomes: DNAChromosome[]): string => {
  return chromosomes
    .map((c) => Math.floor(c.value / 16).toString(16))
    .join('')
    .toUpperCase()
}

// ===== 维度计算函数 =====
const calculateEnergy = (songs: MusicInfo[]): number => {
  let total = 0
  for (const s of songs) {
    const text = (s.name + s.singer).toLowerCase()
    if (/摇滚|rock|metal|punk|dj|dance|电子|舞曲|快|fast|热血|燃烧/.test(text)) total += 90
    else if (/流行|pop/.test(text)) total += 60
    else if (/慢|slow|抒情|ballad|夜|moon|静|calm/.test(text)) total += 20
    else total += 50
  }
  return Math.min(100, Math.round(total / songs.length))
}

const calculateComplexity = (songs: MusicInfo[]): number => {
  const artistSet = new Set(songs.map((s) => s.singer))
  const avgSongsPerArtist = songs.length / Math.max(artistSet.size, 1)
  // 歌手越多且每歌手歌曲越少 = 复杂度越高
  const diversityScore = Math.min(60, artistSet.size * 2)
  const noveltyScore = Math.min(40, Math.max(0, 40 - avgSongsPerArtist * 5))
  return Math.min(100, diversityScore + noveltyScore)
}

const calculateMainstream = (songs: MusicInfo[]): number => {
  let mainstreamCount = 0
  for (const s of songs) {
    const text = (s.name + s.singer).toLowerCase()
    if (/流行|pop|热门|hot|榜单|hit|经典|popular/.test(text)) mainstreamCount++
  }
  return Math.round((mainstreamCount / songs.length) * 100)
}

const calculateDiversity = (songs: MusicInfo[]): number => {
  const artistSet = new Set<string>()
  const sourceSet = new Set<string>()
  for (const s of songs) {
    artistSet.add(s.singer)
    sourceSet.add((s as any).source || 'unknown')
  }
  const artistDiversity = Math.min(70, artistSet.size * 2)
  const sourceDiversity = Math.min(30, sourceSet.size * 6)
  return Math.min(100, artistDiversity + sourceDiversity)
}

const calculateNostalgia = (songs: MusicInfo[]): number => {
  let nostalgiaCount = 0
  for (const s of songs) {
    const text = (s.name + s.singer).toLowerCase()
    if (/怀旧|经典|老歌|岁月|曾经|回忆|retro|classic|80|90年代/.test(text)) nostalgiaCount++
  }
  return Math.round((nostalgiaCount / songs.length) * 100)
}

const calculateEmotion = (songs: MusicInfo[]): number => {
  let emotionCount = 0
  for (const s of songs) {
    const text = (s.name + s.singer).toLowerCase()
    if (/爱|love|心|heart|情|泪|哭|伤|sad|思念|想念|感动/.test(text)) emotionCount++
  }
  return Math.round((emotionCount / songs.length) * 100)
}

const calculateRhythm = (songs: MusicInfo[]): number => {
  let rhythmCount = 0
  for (const s of songs) {
    const text = (s.name + s.singer).toLowerCase()
    if (/舞|dance|节奏|rhythm|鼓|drum|beat|dj|电子/.test(text)) rhythmCount++
  }
  return Math.round((rhythmCount / songs.length) * 100)
}

const calculateAcoustic = (songs: MusicInfo[]): number => {
  let acousticCount = 0
  for (const s of songs) {
    const text = (s.name + s.singer).toLowerCase()
    if (/民谣|folk|吉他|guitar|钢琴|piano|古典|classical|原声|acoustic|轻音乐/.test(text)) acousticCount++
  }
  return Math.round((acousticCount / songs.length) * 100)
}

/** 获取已保存的DNA */
export const getSavedDNA = async (): Promise<MusicDNA | null> => {
  const data = await getData<MusicDNA>(DNA_KEY)
  return data || null
}

/** 比较两个DNA的相似度 */
export const compareDNA = (a: MusicDNA, b: MusicDNA): number => {
  if (a.chromosomes.length === 0 || b.chromosomes.length === 0) return 0
  let diffSum = 0
  for (let i = 0; i < a.chromosomes.length; i++) {
    const ca = a.chromosomes[i]
    const cb = b.chromosomes.find((c) => c.trait === ca.trait)
    if (cb) diffSum += Math.abs(ca.value - cb.value)
  }
  const avgDiff = diffSum / a.chromosomes.length
  return Math.max(0, Math.min(100, 100 - avgDiff))
}

/** 生成DNA报告文本 */
export const generateDNAReport = (dna: MusicDNA): string => {
  let report = `🧬 音乐DNA分析报告\n\n`
  report += `👤 音乐人格: ${dna.personalityType}\n`
  report += `🔖 音乐指纹: ${dna.fingerprint}\n`
  report += `📝 ${dna.description}\n\n`
  report += `📊 特征维度:\n`
  for (const c of dna.chromosomes) {
    const bar = '█'.repeat(Math.floor(c.value / 5)) + '░'.repeat(20 - Math.floor(c.value / 5))
    report += `${c.trait.padEnd(12)} ${bar} ${c.value}\n`
  }
  report += `\n🎯 主导特征: ${dna.dominantTraits.join(', ')}\n`
  return report
}

/** 获取所有人格类型 */
export const getPersonalityTypes = () => PERSONALITY_TYPES

/** 清空DNA数据 */
export const clearDNA = async (): Promise<void> => {
  await saveData(DNA_KEY, null)
  addDevLog('info', 'MusicDNA', 'DNA数据已清空')
}
