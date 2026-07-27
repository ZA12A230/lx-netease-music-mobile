/**
 * 歌词时间轴编辑器模块
 * 手动调整歌词与音乐的同步时间
 */
import { getData, saveData } from '@/plugins/storage'

export interface LyricLine {
  time: number // 毫秒
  text: string
  translation?: string
  roma?: string
}

export interface LyricEdit {
  id: string
  songName: string
  singer: string
  source: string
  originalLines: LyricLine[]
  editedLines: LyricLine[]
  offset: number // 整体偏移（毫秒）
  lastModified: number
}

const STORAGE_KEY = '@lyric_edits_v1'

/** 获取所有编辑过的歌词 */
export const getAllLyricEdits = async (): Promise<LyricEdit[]> => {
  const data = await getData<LyricEdit[]>(STORAGE_KEY)
  return data || []
}

/** 获取指定歌曲的歌词编辑 */
export const getLyricEdit = async (songName: string, singer: string, source: string): Promise<LyricEdit | null> => {
  const all = await getAllLyricEdits()
  return all.find((e) =>
    e.songName === songName && e.singer === singer && e.source === source
  ) || null
}

/** 保存歌词编辑 */
export const saveLyricEdit = async (edit: Omit<LyricEdit, 'id' | 'lastModified'> & { id?: string }): Promise<string> => {
  const all = await getAllLyricEdits()
  const id = edit.id || `lyric_${Date.now()}`
  const lastModified = Date.now()

  // 查找是否已存在
  const existingIndex = all.findIndex((e) =>
    e.songName === edit.songName && e.singer === edit.singer && e.source === edit.source
  )

  const newEdit: LyricEdit = {
    ...edit,
    id,
    lastModified,
  }

  if (existingIndex >= 0) {
    newEdit.id = all[existingIndex].id
    all[existingIndex] = newEdit
  } else {
    all.push(newEdit)
  }

  await saveData(STORAGE_KEY, all)
  return id
}

/** 删除歌词编辑 */
export const deleteLyricEdit = async (id: string): Promise<void> => {
  const all = await getAllLyricEdits()
  const filtered = all.filter((e) => e.id !== id)
  await saveData(STORAGE_KEY, filtered)
}

/** 应用整体偏移 */
export const applyOffset = (lines: LyricLine[], offset: number): LyricLine[] => {
  return lines.map((line) => ({
    ...line,
    time: Math.max(0, line.time + offset),
  }))
}

/** 调整单行歌词时间 */
export const adjustLineTime = (lines: LyricLine[], index: number, newTime: number): LyricLine[] => {
  if (index < 0 || index >= lines.length) return lines
  return lines.map((line, i) => i === index ? { ...line, time: Math.max(0, newTime) } : line)
}

/** 批量调整时间（按比例） */
export const scaleLineTimes = (lines: LyricLine[], scale: number): LyricLine[] => {
  return lines.map((line) => ({
    ...line,
    time: Math.max(0, Math.round(line.time * scale)),
  }))
}

/** 解析 LRC 格式歌词 */
export const parseLRC = (lrc: string): LyricLine[] => {
  const lines: LyricLine[] = []
  const regex = /\[(\d+):(\d+)\.(\d+)\](.*)/
  for (const line of lrc.split('\n')) {
    const match = line.match(regex)
    if (match) {
      const min = parseInt(match[1], 10)
      const sec = parseInt(match[2], 10)
      const ms = parseInt(match[3], 10)
      const time = (min * 60 + sec) * 1000 + ms * 10
      lines.push({ time, text: match[4].trim() })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

/** 导出为 LRC 格式 */
export const exportLRC = (lines: LyricLine[]): string => {
  return lines.map((line) => {
    const totalSec = line.time / 1000
    const min = Math.floor(totalSec / 60)
    const sec = Math.floor(totalSec % 60)
    const ms = Math.floor((line.time % 1000) / 10)
    const timeStr = `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`
    let content = timeStr + line.text
    if (line.translation) content += `\n${timeStr}${line.translation}`
    return content
  }).join('\n')
}

/** 自动同步歌词（基于已有歌词的偏移推测） */
export const autoSyncLyrics = (lines: LyricLine[], referenceTime: number, actualTime: number): {
  adjustedLines: LyricLine[]
  offset: number
} => {
  const offset = actualTime - referenceTime
  return {
    adjustedLines: applyOffset(lines, offset),
    offset,
  }
}

/** 检测歌词与音乐是否同步 */
export const detectSyncIssue = (lines: LyricLine[], currentTime: number): {
  isSynced: boolean
  currentLineIndex: number
  offset: number
} => {
  let currentLineIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) {
      currentLineIndex = i
    } else {
      break
    }
  }

  if (currentLineIndex < 0) {
    return { isSynced: false, currentLineIndex: -1, offset: 0 }
  }

  const expectedTime = lines[currentLineIndex].time
  const offset = currentTime - expectedTime
  return {
    isSynced: Math.abs(offset) < 500, // 500ms内视为同步
    currentLineIndex,
    offset,
  }
}
