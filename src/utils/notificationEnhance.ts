/**
 * 通知栏增强工具
 * 增强通知栏控件：喜欢/不喜欢按钮、歌词滚动
 */
import TrackPlayer, { Capability } from 'react-native-track-player'

/** 更新通知栏的播放控制能力 */
export const updateNotificationCapabilities = () => {
  TrackPlayer.updateOptions({
    // 添加喜欢/不喜欢按钮
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.Stop,
      Capability.JumpForward,
      Capability.JumpBackward,
      // 使用 JumpForward/JumpBackward 作为自定义按钮
      // 注意：react-native-track-player 不支持自定义按钮名称
      // 但我们可以通过 RemoteJumpForward/RemoteJumpBackward 事件来实现
    ],
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
    // 通知栏样式
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
    ],
  })
}

/**
 * 注册通知栏自定义按钮事件
 * JumpForward -> 喜欢当前歌曲
 * JumpBackward -> 不喜欢当前歌曲
 */
export const setupNotificationLikeActions = (
  onLike: () => void,
  onDislike: () => void,
) => {
  TrackPlayer.addEventListener('remote-jump-forward', () => {
    onLike()
  })
  TrackPlayer.addEventListener('remote-jump-backward', () => {
    onDislike()
  })
}

/** 更新通知栏显示歌词 */
export const updateNotificationLyric = (lyric: string) => {
  // react-native-track-player 不直接支持通知栏歌词
  // 但可以通过更新 description 字段来显示当前歌词
  // 这需要原生模块支持，这里提供接口框架
  try {
    // TrackPlayer 的 description 可以显示在通知栏
    // 但需要 Android 原生代码支持
  } catch (e) {
    console.warn('更新通知栏歌词失败:', e)
  }
}

/** 通知栏增强：显示专辑封面、歌词 */
export const enhanceNotification = async (
  title: string,
  artist: string,
  album?: string,
  artwork?: string,
  lyric?: string,
) => {
  await TrackPlayer.updateNowPlayingMetadata({
    title,
    artist,
    album,
    artwork,
    description: lyric || '',
  })
}