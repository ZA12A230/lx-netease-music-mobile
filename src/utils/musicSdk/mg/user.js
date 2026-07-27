import { httpFetch } from '../../request'
import settingState from '@/store/setting/state'
import { toast } from '@/utils/tools'

/**
 * 咪咕音乐用户API模块
 * 通过Cookie获取用户信息、收藏歌单、喜欢歌曲等
 */
export default {
  /**
   * 获取用户UID
   */
  async getUid(cookie, retryNum = 0) {
    if (!cookie) throw new Error('Cookie is required to get UID')
    const maxRetries = 3
    const retryDelay = 200

    try {
      const request = httpFetch('https://m.music.migu.cn/migu/user/info', {
        method: 'get',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
          Referer: 'https://m.music.migu.cn',
          cookie,
        },
      })
      const { body, statusCode } = await request.promise
      if (statusCode !== 200 || body.code !== '000000') throw new Error('获取咪咕UID失败')
      const uid = body.data?.userInfo?.userId
      if (!uid) throw new Error('登录已过期或Cookie无效')
      return String(uid)
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getUid(cookie, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 获取用户收藏歌单
   */
  async getUserPlaylists(uid, cookie, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const request = httpFetch('https://m.music.migu.cn/migu/user/playlist/list', {
        method: 'get',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
          Referer: 'https://m.music.migu.cn',
          cookie,
        },
        form: {
          userId: uid,
          pageNo: 1,
          pageSize: 100,
        },
      })
      const { body, statusCode } = await request.promise
      if (statusCode !== 200 || body.code !== '000000') throw new Error('获取咪咕歌单失败')
      return (body.data?.list || []).map(item => ({
        id: item.playlistId,
        name: item.name,
        coverImgUrl: item.picUrl || '',
        userId: uid,
        trackCount: item.trackCount || 0,
      }))
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getUserPlaylists(uid, cookie, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 获取收藏的歌手列表
   */
  async getSublist(cookie, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const request = httpFetch('https://m.music.migu.cn/migu/user/follow/artist', {
        method: 'get',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
          Referer: 'https://m.music.migu.cn',
          cookie,
        },
        form: { pageNo: 1, pageSize: 200 },
      })
      const { body, statusCode } = await request.promise
      if (statusCode !== 200 || body.code !== '000000') throw new Error('获取咪咕关注歌手失败')
      return (body.data?.list || []).map(s => ({
        id: s.artistId,
        name: s.artistName,
        picUrl: s.picUrl || '',
        alias: null,
        albumSize: s.albumCount || 0,
        img1v1Url: s.picUrl || '',
      }))
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getSublist(cookie, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 获取收藏的专辑列表
   */
  async getAlbumSublist(cookie, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const request = httpFetch('https://m.music.migu.cn/migu/user/follow/album', {
        method: 'get',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36',
          Referer: 'https://m.music.migu.cn',
          cookie,
        },
        form: { pageNo: 1, pageSize: 200 },
      })
      const { body, statusCode } = await request.promise
      if (statusCode !== 200 || body.code !== '000000') throw new Error('获取咪咕收藏专辑失败')
      return (body.data?.list || []).map(a => ({
        id: a.albumId,
        name: a.albumName,
        picUrl: a.picUrl || '',
        artists: [{ id: a.artistId, name: a.artistName }],
        publishTime: 0,
        size: a.trackCount || 0,
      }))
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getAlbumSublist(cookie, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 验证Cookie有效性
   */
  async checkCookie(cookie) {
    try {
      await this.getUid(cookie)
      return true
    } catch {
      return false
    }
  },
}