/**
 * 歌词滚动同步精度优化工具
 * 提供平滑滚动、预判下一行、动画过渡等功能
 */
import { type Animated } from 'react-native'

/** 歌词行 */
export interface LyricLine {
  time: number        // 毫秒
  text: string
  duration?: number   // 毫秒
}

/** 歌词滚动配置 */
export interface LyricScrollConfig {
  /** 滚动动画时长（ms） */
  animationDuration: number
  /** 预判时间偏移（ms），提前滚动到下一行 */
  lookAheadOffset: number
  /** 是否启用弹性动画 */
  useSpringAnimation: boolean
  /** 滚动偏移比例（0-1），当前行在屏幕中的位置 */
  scrollOffsetRatio: number
}

/** 默认配置 */
const DEFAULT_SCROLL_CONFIG: LyricScrollConfig = {
  animationDuration: 300,
  lookAheadOffset: 500,    // 提前500ms滚动
  useSpringAnimation: false,
  scrollOffsetRatio: 0.35, // 当前行在屏幕35%位置
}

/**
 * 解析LRC歌词
 * @param lrcText LRC歌词文本
 * @returns 解析后的歌词行数组
 */
export const parseLrc = (lrcText: string): LyricLine[] => {
  const lines: LyricLine[] = []
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g
  const rawLines = lrcText.split('\n')

  for (const rawLine of rawLines) {
    const text = rawLine.replace(timeRegex, '').trim()
    if (!text) continue

    // 重置正则
    timeRegex.lastIndex = 0
    let match
    while ((match = timeRegex.exec(rawLine)) !== null) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      let ms = 0
      if (match[3]) {
        ms = parseInt(match[3].padEnd(3, '0'), 10)
      }
      const time = minutes * 60 * 1000 + seconds * 1000 + ms
      lines.push({ time, text })
    }
  }

  // 按时间排序
  lines.sort((a, b) => a.time - b.time)

  // 计算每行的持续时间
  for (let i = 0; i < lines.length; i++) {
    if (i < lines.length - 1) {
      lines[i].duration = lines[i + 1].time - lines[i].time
    } else {
      lines[i].duration = 5000 // 最后一行默认5秒
    }
  }

  return lines
}

/**
 * 查找当前播放时间对应的歌词行索引
 * @param lines 歌词行数组
 * @param currentTime 当前播放时间（毫秒）
 * @param config 滚动配置
 * @returns 当前行索引
 */
export const findCurrentLyricIndex = (
  lines: LyricLine[],
  currentTime: number,
  config: Partial<LyricScrollConfig> = {},
): number => {
  const { lookAheadOffset } = { ...DEFAULT_SCROLL_CONFIG, ...config }
  const adjustedTime = currentTime + lookAheadOffset

  // 二分查找
  let left = 0
  let right = lines.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (lines[mid].time <= adjustedTime) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }

  return Math.max(0, right)
}

/**
 * 计算平滑滚动偏移量
 * @param lines 歌词行数组
 * @param currentTime 当前播放时间（毫秒）
 * @param currentIndex 当前行索引
 * @param lineHeight 每行高度（像素）
 * @param config 滚动配置
 * @returns 滚动偏移量（像素）
 */
export const calculateScrollOffset = (
  lines: LyricLine[],
  currentTime: number,
  currentIndex: number,
  lineHeight: number,
  config: Partial<LyricScrollConfig> = {},
): number => {
  const { scrollOffsetRatio } = { ...DEFAULT_SCROLL_CONFIG, ...config }

  // 基础偏移：当前行在视图中的目标位置
  const baseOffset = currentIndex * lineHeight - scrollOffsetRatio * lineHeight

  // 插值：在当前行内平滑过渡
  if (currentIndex < lines.length - 1 && lines[currentIndex].duration) {
    const lineStart = lines[currentIndex].time
    const lineDuration = lines[currentIndex].duration!
    const progress = Math.min(1, Math.max(0, (currentTime - lineStart) / lineDuration))

    // 根据进度微调偏移
    const microOffset = progress * lineHeight * 0.5
    return baseOffset + microOffset
  }

  return baseOffset
}

/**
 * 判断是否需要滚动动画
 * @param oldIndex 旧行索引
 * @param newIndex 新行索引
 * @param lines 歌词行数组
 * @returns 是否使用动画
 */
export const shouldAnimateScroll = (
  oldIndex: number,
  newIndex: number,
  lines: LyricLine[],
): boolean => {
  // 如果跳了很多行，不动画（直接跳到新位置）
  if (Math.abs(newIndex - oldIndex) > 5) return false
  // 如果两行之间时间差超过3秒，不动画
  if (newIndex < lines.length && oldIndex >= 0) {
    const timeDiff = Math.abs(lines[newIndex].time - lines[oldIndex].time)
    if (timeDiff > 3000) return false
  }
  return true
}

/**
 * 获取下一行歌词的预提示
 * @param lines 歌词行数组
 * @param currentIndex 当前行索引
 * @returns 下一行歌词文本，如果已到最后一行则返回null
 */
export const getNextLineHint = (
  lines: LyricLine[],
  currentIndex: number,
): string | null => {
  if (currentIndex < lines.length - 1) {
    return lines[currentIndex + 1].text
  }
  return null
}

/**
 * 计算歌词行的时间进度（用于行内高亮）
 * @param line 当前歌词行
 * @param currentTime 当前播放时间（毫秒）
 * @returns 进度 0-1
 */
export const getLineProgress = (
  line: LyricLine,
  currentTime: number,
): number => {
  if (!line.duration || line.duration <= 0) return 0
  const elapsed = currentTime - line.time
  return Math.min(1, Math.max(0, elapsed / line.duration))
}

/**
 * 创建滚动动画
 * @param animatedValue Animated.Value
 * @param targetOffset 目标偏移量
 * @param config 滚动配置
 */
export const animateScrollTo = (
  animatedValue: Animated.Value,
  targetOffset: number,
  config: Partial<LyricScrollConfig> = {},
) => {
  const { animationDuration, useSpringAnimation } = { ...DEFAULT_SCROLL_CONFIG, ...config }

  if (useSpringAnimation) {
    Animated.spring(animatedValue, {
      toValue: targetOffset,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start()
  } else {
    Animated.timing(animatedValue, {
      toValue: targetOffset,
      duration: animationDuration,
      useNativeDriver: true,
    }).start()
  }
}