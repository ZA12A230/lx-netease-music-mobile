import { Buffer } from 'buffer'

/**
 * 歌单分享码工具
 * 生成短码/二维码，让其他用户快速导入歌单
 */

/** 生成歌单分享码 */
export const generateShareCode = (playlist: {
  name: string
  songs: Array<{
    name: string
    singer: string
    source: string
    songId: string | number
  }>
}): string => {
  const data = JSON.stringify({
    v: 1,
    name: playlist.name,
    songs: playlist.songs.map(s => ({
      n: s.name,
      a: s.singer,
      s: s.source,
      id: s.songId,
    })),
    t: Date.now(),
  })
  return Buffer.from(data).toString('base64').replace(/=+$/, '')
}

/** 解析歌单分享码 */
export const parseShareCode = (code: string): {
  name: string
  songs: Array<{
    name: string
    singer: string
    source: string
    songId: string | number
  }>
  timestamp: number
} | null => {
  try {
    // 补齐 base64 padding
    const padded = code + '='.repeat((4 - (code.length % 4)) % 4)
    const json = Buffer.from(padded, 'base64').toString('utf-8')
    const data = JSON.parse(json)
    if (data.v !== 1) return null
    return {
      name: data.name,
      songs: data.songs.map((s: any) => ({
        name: s.n,
        singer: s.a,
        source: s.s,
        songId: s.id,
      })),
      timestamp: data.t,
    }
  } catch {
    return null
  }
}

/** 生成歌单分享二维码数据URL */
export const generateQRDataUrl = (code: string): string => {
  // 使用 QR Server API 生成二维码
  const encodedCode = encodeURIComponent(code)
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedCode}`
}