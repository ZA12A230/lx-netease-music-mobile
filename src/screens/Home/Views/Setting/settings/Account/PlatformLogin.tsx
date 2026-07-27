import { memo, useState, useCallback } from 'react'
import { View, ActivityIndicator } from 'react-native'
import InputItem from '../../components/InputItem'
import Button from '../../components/Button'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import wyApi from '@/utils/musicSdk/wy/user'
import txApi from '@/utils/musicSdk/tx/user'
import kgApi from '@/utils/musicSdk/kg/user'
import kwApi from '@/utils/musicSdk/kw/user'
import mgApi from '@/utils/musicSdk/mg/user'
import * as userActions from '@/store/user/action'

/** 平台信息配置 */
const PLATFORM_CONFIG: Record<string, {
  name: string
  color: string
  cookieKey: keyof LX.AppSetting
  api: any
  loginUrl: string
  successUrlFlag: string
  eventName: string
}> = {
  wy: {
    name: '网易云音乐',
    color: '#EC4141',
    cookieKey: 'common.wy_cookie',
    api: wyApi,
    loginUrl: 'https://music.163.com/m/login',
    successUrlFlag: 'music.163.com',
    eventName: 'wy-cookie-set',
  },
  tx: {
    name: 'QQ音乐',
    color: '#31C27C',
    cookieKey: 'common.tx_cookie',
    api: txApi,
    loginUrl: 'https://y.qq.com/m/login',
    successUrlFlag: 'y.qq.com',
    eventName: 'tx-cookie-set',
  },
  kg: {
    name: '酷狗音乐',
    color: '#2D8CF0',
    cookieKey: 'common.kg_cookie',
    api: kgApi,
    loginUrl: 'https://m.kugou.com/login',
    successUrlFlag: 'kugou.com',
    eventName: 'kg-cookie-set',
  },
  kw: {
    name: '酷我音乐',
    color: '#FFA800',
    cookieKey: 'common.kw_cookie',
    api: kwApi,
    loginUrl: 'http://www.kuwo.cn/m/login',
    successUrlFlag: 'kuwo.cn',
    eventName: 'kw-cookie-set',
  },
  mg: {
    name: '咪咕音乐',
    color: '#FF3366',
    cookieKey: 'common.mg_cookie',
    api: mgApi,
    loginUrl: 'https://m.music.migu.cn/login',
    successUrlFlag: 'migu.cn',
    eventName: 'mg-cookie-set',
  },
}

type LoginStatus = 'idle' | 'checking' | 'logged_in' | 'failed'

interface PlatformLoginProps {
  platformId: string
}

export default memo(({ platformId }: PlatformLoginProps) => {
  const config = PLATFORM_CONFIG[platformId]
  if (!config) return null

  const theme = useTheme()
  const cookie = useSettingValue(config.cookieKey)
  const [status, setStatus] = useState<LoginStatus>('idle')
  const [uid, setUid] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const setCookie = useCallback((val: string) => {
    updateSetting({ [config.cookieKey]: val } as any)
    if (val) {
      setStatus('idle')
    } else {
      setStatus('idle')
      setUid(null)
    }
  }, [config.cookieKey])

  const handleChanged = useCallback((text: string, callback: (value: string) => void) => {
    callback(text)
    setCookie(text)
  }, [setCookie])

  /** 打开网页登录 */
  const handleWebLogin = useCallback(() => {
    global.app_event.emit('showMultiPlatformLogin', {
      platformId,
      loginUrl: config.loginUrl,
      successUrlFlag: config.successUrlFlag,
      eventName: config.eventName,
      api: config.api,
    })
  }, [platformId, config])

  /** 验证Cookie有效性 */
  const handleVerify = useCallback(async () => {
    if (!cookie || status === 'checking') return
    setStatus('checking')
    try {
      await config.api.checkCookie(cookie)
      const userId = await config.api.getUid(cookie)
      setUid(String(userId))
      setStatus('logged_in')
      toast(`${config.name} Cookie有效，UID: ${userId}`)
    } catch (error: any) {
      setStatus('failed')
      toast(`${config.name} Cookie无效: ${error.message}`)
    }
  }, [cookie, status, config])

  /** 同步用户数据 */
  const handleSync = useCallback(async () => {
    if (!cookie || isSyncing || status !== 'logged_in') return
    setIsSyncing(true)
    try {
      const currentUid = uid || await config.api.getUid(cookie)
      setUid(String(currentUid))

      toast(`${config.name} 开始同步数据...`)

      const prefix = platformId // wy/tx/kg/kw/mg
      // 设置 UID 到 store
      const setUidAction = (userActions as any)[`set${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Uid`]
      if (setUidAction) setUidAction(String(currentUid))

      // 同步歌单
      try {
        const playlists = await config.api.getUserPlaylists(currentUid, cookie)
        console.log(`${config.name} 歌单同步完成: ${playlists.length} 个`)
        const setPlaylists = (userActions as any)[`set${prefix.charAt(0).toUpperCase() + prefix.slice(1)}SubscribedPlaylists`]
        if (setPlaylists) setPlaylists(playlists)
      } catch (e) {
        console.warn(`${config.name} 歌单同步失败:`, e)
      }

      // 同步关注歌手 (wy API不需要cookie参数)
      try {
        const artists = platformId === 'wy'
          ? await config.api.getAllSublist()
          : await config.api.getSublist(cookie)
        console.log(`${config.name} 歌手同步完成: ${artists.length} 个`)
        const setArtists = (userActions as any)[`set${prefix.charAt(0).toUpperCase() + prefix.slice(1)}FollowedArtists`]
        if (setArtists) setArtists(artists)
      } catch (e) {
        console.warn(`${config.name} 歌手同步失败:`, e)
      }

      // 同步收藏专辑 (wy API不需要cookie参数)
      try {
        const albums = platformId === 'wy'
          ? await config.api.getAllSubAlbumList()
          : await config.api.getAlbumSublist(cookie)
        console.log(`${config.name} 专辑同步完成: ${albums.length} 个`)
        const setAlbums = (userActions as any)[`set${prefix.charAt(0).toUpperCase() + prefix.slice(1)}SubscribedAlbums`]
        if (setAlbums) setAlbums(albums)
      } catch (e) {
        console.warn(`${config.name} 专辑同步失败:`, e)
      }

      toast(`${config.name} 数据同步完成`)
    } catch (error: any) {
      toast(`${config.name} 同步失败: ${error.message}`)
    } finally {
      setIsSyncing(false)
    }
  }, [cookie, isSyncing, status, uid, config, platformId])

  const statusColor = status === 'logged_in' ? '#4CAF50' : status === 'failed' ? '#F44336' : theme['c-font-label']
  const statusText = status === 'checking' ? '验证中...'
    : status === 'logged_in' ? `已登录 (UID: ${uid})`
    : status === 'failed' ? 'Cookie无效'
    : cookie ? '未验证' : '未登录'

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.platformDot, { backgroundColor: config.color }]} />
        <Text style={styles.platformName} size={15}>{config.name}</Text>
        <View style={styles.statusContainer}>
          {status === 'checking' && <ActivityIndicator size="small" color={config.color} />}
          <Text style={styles.statusText} size={12} color={statusColor}>{statusText}</Text>
        </View>
      </View>

      <InputItem
        value={cookie}
        label={`${config.name} Cookie`}
        onChanged={handleChanged}
        placeholder={`在此处粘贴 ${config.name} 的 Cookie`}
      />

      <View style={styles.btnRow}>
        <Button onPress={handleWebLogin}>网页登录</Button>
        <Button onPress={handleVerify} disabled={!cookie || status === 'checking'}>
          {status === 'checking' ? '验证中...' : '验证'}
        </Button>
        {status === 'logged_in' && (
          <Button onPress={handleSync} disabled={isSyncing}>
            {isSyncing ? '同步中...' : '同步数据'}
          </Button>
        )}
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 25,
    marginBottom: 8,
  },
  platformDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  platformName: {
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginRight: 5,
  },
  btnRow: {
    flexDirection: 'row',
    paddingLeft: 25,
    marginTop: 5,
    marginBottom: 5,
    flexWrap: 'wrap',
  },
})