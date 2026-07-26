import { httpFetch } from '../../request'
import settingState from '@/store/setting/state'
import { toast } from '@/utils/tools'

/**
 * 酷我音乐用户API模块
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
      const request = httpFetch('http://www.kuwo.cn/api/www/user/userInfo', {
        method: 'get',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'http://www.kuwo.cn',
          cookie,
          csrf: (cookie.match(/kw_token=([^(;|$)]+)/) || [])[1] || '',
        },
      })
      const { body, statusCode } = await request.promise
      if (statusCode !== 200 || body.code !== 200) throw new Error('获取酷我UID失败')
      const uid = body.data?.id
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
      const request = httpFetch('http://www.kuwo.cn/api/www/user/playlist/getUserPlaylist', {
        method: 'get',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'http://www.kuwo.cn',
          cookie,
          csrf: (cookie.match(/kw_token=([^(;|$)]+)/) || [])[1] || '',
        },
        form: {
          uid,
          pn: 1,
          rn: 100,
        },
      })
      const { body, statusCode } = await request.promise
      if (statusCode !== 200 || body.code !== 200) throw new Error('获取酷我歌单失败')
      return (body.data?.data || []).map(item => ({
        id: item.id,
        name: item.name,
        coverImgUrl: item.img || '',
        userId: uid,
        trackCount: item.total || 0,
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
      const request = httpFetch('http://www.kuwo.cn/api/www/user/follow/artistList', {
        method: 'get',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'http://www.kuwo.cn',
          cookie,
          csrf: (cookie.match(/kw_token=([^(;|$)]+)/) || [])[1] || '',
        },
        form: { pn: 1, rn: 200 },
      })
      const { body, statusCode } = await request.promise
      if (statusCode !== 200 || body.code !== 200) throw new Error('获取酷我关注歌手失败')
      return (body.data?.data || []).map(s => ({
        id: s.id,
        name: s.name,
        picUrl: s.pic || '',
        alias: null,
        albumSize: s.albumTotal || 0,
        img1v1Url: s.pic || '',
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
      const request = httpFetch('http://www.kuwo.cn/api/www/user/follow/albumList', {
        method: 'get',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'http://www.kuwo.cn',
          cookie,
          csrf: (cookie.match(/kw_token=([^(;|$)]+)/) || [])[1] || '',
        },
        form: { pn: 1, rn: 200 },
      })
      const { body, statusCode } = await request.promise
      if (statusCode !== 200 || body.code !== 200) throw new Error('获取酷我收藏专辑失败')
      return (body.data?.data || []).map(a => ({
        id: a.id,
        name: a.name,
        picUrl: a.pic || '',
        artists: [{ id: a.artistid, name: a.artist }],
        publishTime: 0,
        size: a.total || 0,
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