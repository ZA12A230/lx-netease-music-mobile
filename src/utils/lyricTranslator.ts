/**
 * 歌词多语言翻译增强
 * 支持多语言互译、词汇注释、文化背景说明
 */
import { chat } from '@/core/ai'
import { getData, saveData } from '@/plugins/storage'
import { addDevLog } from './devKit'

export type TranslationLanguage =
  | 'zh-cn'   // 简体中文
  | 'zh-tw'   // 繁体中文
  | 'en'      // 英文
  | 'ja'      // 日文
  | 'ko'      // 韩文
  | 'fr'      // 法文
  | 'de'      // 德文
  | 'es'      // 西班牙文
  | 'ru'      // 俄文
  | 'th'      // 泰文

export interface LyricTranslation {
  original: string
  translated: string
  language: TranslationLanguage
  /** 词汇注释 */
  annotations?: Array<{
    word: string
    meaning: string
    grammar?: string
  }>
  /** 文化背景 */
  culturalNote?: string
}

export interface TranslationCache {
  [lyricHash: string]: {
    translations: Record<string, LyricTranslation>
    timestamp: number
  }
}

const CACHE_KEY = '@lyric_translations_v1'
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30天

const LANGUAGE_NAMES: Record<TranslationLanguage, string> = {
  'zh-cn': '简体中文',
  'zh-tw': '繁體中文',
  'en': 'English',
  'ja': '日本語',
  'ko': '한국어',
  'fr': 'Français',
  'de': 'Deutsch',
  'es': 'Español',
  'ru': 'Русский',
  'th': 'ภาษาไทย',
}

export const getLanguageName = (lang: TranslationLanguage): string => LANGUAGE_NAMES[lang]

/** 检测原文语言 */
export const detectLanguage = (text: string): TranslationLanguage => {
  if (/[\u4e00-\u9fa5]/.test(text)) {
    // 简单判断繁简
    return 'zh-cn'
  }
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'
  if (/[\uac00-\ud7af]/.test(text)) return 'ko'
  if (/[\u0400-\u04FF]/.test(text)) return 'ru'
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th'
  return 'en'
}

/** 翻译歌词 */
export const translateLyric = async (
  lyric: string,
  targetLanguage: TranslationLanguage,
): Promise<LyricTranslation | null> => {
  if (!lyric.trim()) return null

  const sourceLang = detectLanguage(lyric)
  if (sourceLang === targetLanguage) return null

  // 检查缓存
  const cache = await getCache()
  const hash = simpleHash(lyric + targetLanguage)
  const cached = cache[hash]
  if (cached && cached.translations[targetLanguage]) {
    const age = Date.now() - cached.timestamp
    if (age < CACHE_MAX_AGE) {
      return cached.translations[targetLanguage]
    }
  }

  try {
    const prompt = `请将以下歌词翻译为${LANGUAGE_NAMES[targetLanguage]}，并提供:
1. 翻译后的歌词
2. 关键词汇注释（最多5个）
3. 文化背景说明（如有必要）

原文歌词:
${lyric}

请以JSON格式返回:
{
  "translated": "翻译后的歌词",
  "annotations": [{"word": "原词", "meaning": "释义", "grammar": "语法说明"}],
  "culturalNote": "文化背景"
}`

    const result = await chat(prompt, [])
    if (!result) return null

    let parsed: any
    try {
      // 尝试提取JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      parsed = { translated: result }
    }

    const translation: LyricTranslation = {
      original: lyric,
      translated: parsed?.translated || result,
      language: targetLanguage,
      annotations: parsed?.annotations,
      culturalNote: parsed?.culturalNote,
    }

    // 保存到缓存
    if (!cache[hash]) cache[hash] = { translations: {}, timestamp: Date.now() }
    cache[hash].translations[targetLanguage] = translation
    cache[hash].timestamp = Date.now()
    await saveData(CACHE_KEY, cache)

    addDevLog('info', 'LyricTranslator', `翻译歌词到${LANGUAGE_NAMES[targetLanguage]}`)
    return translation
  } catch (e: any) {
    addDevLog('error', 'LyricTranslator', `翻译失败: ${e?.message}`)
    return null
  }
}

/** 批量翻译歌词 */
export const translateLyricsBatch = async (
  lyrics: string[],
  targetLanguage: TranslationLanguage,
): Promise<(LyricTranslation | null)[]> => {
  const results: (LyricTranslation | null)[] = []
  for (const lyric of lyrics) {
    const result = await translateLyric(lyric, targetLanguage)
    results.push(result)
  }
  return results
}

/** 获取多语言翻译 */
export const getMultiLanguageTranslations = async (
  lyric: string,
  languages: TranslationLanguage[],
): Promise<Record<string, LyricTranslation | null>> => {
  const results: Record<string, LyricTranslation | null> = {}
  for (const lang of languages) {
    results[lang] = await translateLyric(lyric, lang)
  }
  return results
}

/** 提取歌词中的生词 */
export const extractVocabulary = (lyric: string): Array<{ word: string; context: string }> => {
  const vocabulary: Array<{ word: string; context: string }> = []
  const lines = lyric.split('\n')

  for (const line of lines) {
    // 移除时间标签
    const cleanLine = line.replace(/\[\d+:\d+\.\d+\]/g, '').trim()
    if (!cleanLine) continue

    // 提取英文单词
    const englishWords = cleanLine.match(/[a-zA-Z]+/g) || []
    for (const word of englishWords) {
      if (word.length >= 4) { // 4个字母以上的词
        vocabulary.push({ word: word.toLowerCase(), context: cleanLine })
      }
    }

    // 提取中文词组（简化）
    const chineseWords = cleanLine.match(/[\u4e00-\u9fa5]{2,4}/g) || []
    for (const word of chineseWords) {
      vocabulary.push({ word, context: cleanLine })
    }
  }

  // 去重
  const seen = new Set<string>()
  return vocabulary.filter((v) => {
    if (seen.has(v.word)) return false
    seen.add(v.word)
    return true
  })
}

const getCache = async (): Promise<TranslationCache> => {
  const data = await getData<TranslationCache>(CACHE_KEY)
  return data || {}
}

const simpleHash = (text: string): string => {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/** 清空翻译缓存 */
export const clearTranslationCache = async (): Promise<void> => {
  await saveData(CACHE_KEY, {})
  addDevLog('info', 'LyricTranslator', '翻译缓存已清空')
}

/** 获取缓存统计 */
export const getCacheStats = async (): Promise<{ count: number; size: number }> => {
  const cache = await getCache()
  const count = Object.keys(cache).length
  const size = JSON.stringify(cache).length
  return { count, size }
}
