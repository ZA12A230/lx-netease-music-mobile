/**
 * 手势快捷操作模块
 * 提供双击、滑动等手势控制播放器
 */
import { useRef, useCallback } from 'react'
import { GestureResponderEvent, PanResponder } from 'react-native'
import TrackPlayer from 'react-native-track-player'
import playerState from '@/store/player/state'
import { addDevLog } from './devKit'

export type GestureAction = 'play_pause' | 'next' | 'prev' | 'volume_up' | 'volume_down' | 'seek_forward' | 'seek_back'

export interface GestureConfig {
  doubleTap: GestureAction
  longPress: GestureAction
  swipeLeft: GestureAction
  swipeRight: GestureAction
  swipeUp: GestureAction
  swipeDown: GestureAction
  /** 滑动阈值 */
  swipeThreshold: number
  /** 长按时间 */
  longPressDelay: number
}

const DEFAULT_CONFIG: GestureConfig = {
  doubleTap: 'play_pause',
  longPress: 'next',
  swipeLeft: 'next',
  swipeRight: 'prev',
  swipeUp: 'volume_up',
  swipeDown: 'volume_down',
  swipeThreshold: 50,
  longPressDelay: 500,
}

/** 执行手势动作 */
export const executeGestureAction = async (action: GestureAction): Promise<void> => {
  try {
    switch (action) {
      case 'play_pause': {
        const state = await TrackPlayer.getPlaybackState()
        if (state.state === 'playing') {
          await TrackPlayer.pause()
        } else {
          await TrackPlayer.play()
        }
        break
      }
      case 'next':
        await TrackPlayer.skipToNext()
        break
      case 'prev':
        await TrackPlayer.skipToPrevious()
        break
      case 'volume_up': {
        const newVol = Math.min(1, playerState.volume + 0.1)
        await TrackPlayer.setVolume(newVol)
        playerState.volume = newVol
        break
      }
      case 'volume_down': {
        const newVol = Math.max(0, playerState.volume - 0.1)
        await TrackPlayer.setVolume(newVol)
        playerState.volume = newVol
        break
      }
      case 'seek_forward': {
        const pos = await TrackPlayer.getPosition()
        await TrackPlayer.seekTo(pos + 10)
        break
      }
      case 'seek_back': {
        const pos = await TrackPlayer.getPosition()
        await TrackPlayer.seekTo(Math.max(0, pos - 10))
        break
      }
    }
  } catch (e: any) {
    addDevLog('error', 'Gesture', `手势动作执行失败: ${action} - ${e?.message}`)
  }
}

/** 手势配置缓存 */
let currentConfig: GestureConfig = { ...DEFAULT_CONFIG }

export const getGestureConfig = (): GestureConfig => ({ ...currentConfig })

export const updateGestureConfig = (config: Partial<GestureConfig>) => {
  currentConfig = { ...currentConfig, ...config }
}

/**
 * 创建手势响应器
 * 用于绑定到组件上，提供手势控制能力
 */
export const createGestureHandlers = (config?: Partial<GestureConfig>) => {
  const finalConfig = { ...currentConfig, ...config }
  const lastTapRef = useRef(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTap = useCallback((action: GestureAction) => {
    void executeGestureAction(action)
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > finalConfig.swipeThreshold ||
               Math.abs(gestureState.dy) > finalConfig.swipeThreshold
      },
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        // 长按计时
        if (finalConfig.longPress !== 'play_pause') {
          longPressTimerRef.current = setTimeout(() => {
            handleTap(finalConfig.longPress)
          }, finalConfig.longPressDelay)
        }
      },
      onPanResponderRelease: (evt: GestureResponderEvent, gestureState) => {
        // 清除长按计时
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }

        const { dx, dy } = gestureState
        const threshold = finalConfig.swipeThreshold

        // 检测滑动
        if (Math.abs(dx) > Math.abs(dy)) {
          // 水平滑动
          if (dx > threshold) {
            handleTap(finalConfig.swipeRight)
            return
          }
          if (dx < -threshold) {
            handleTap(finalConfig.swipeLeft)
            return
          }
        } else {
          // 垂直滑动
          if (dy < -threshold) {
            handleTap(finalConfig.swipeUp)
            return
          }
          if (dy > threshold) {
            handleTap(finalConfig.swipeDown)
            return
          }
        }

        // 检测双击
        const now = Date.now()
        if (now - lastTapRef.current < 300) {
          handleTap(finalConfig.doubleTap)
          lastTapRef.current = 0
        } else {
          lastTapRef.current = now
        }
      },
      onPanResponderTerminate: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
      },
    })
  ).current

  return { panResponder }
}

/** 获取手势动作的友好描述 */
export const getGestureActionName = (action: GestureAction): string => {
  const names: Record<GestureAction, string> = {
    play_pause: '播放/暂停',
    next: '下一首',
    prev: '上一首',
    volume_up: '音量+',
    volume_down: '音量-',
    seek_forward: '快进10秒',
    seek_back: '后退10秒',
  }
  return names[action]
}
