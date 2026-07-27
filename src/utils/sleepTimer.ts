/**
 * 睡眠定时器增强模块
 * 支持: 播放完当前歌曲后关闭、音量渐弱模式
 */
import { startTimeoutExit, stopTimeoutExit, cancelTimeoutExit, onTimeUpdate } from '@/core/player/timeoutExit'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'
import TrackPlayer from 'react-native-track-player'

export type SleepTimerMode = 'normal' | 'fade_out' | 'after_current'

let fadeOutInterval: ReturnType<typeof setInterval> | null = null
let originalVolume = 1
let fadeOutStartTime = 0
let fadeOutDuration = 0

/** 启动睡眠定时器 */
export const startSleepTimer = (time: number, mode: SleepTimerMode = 'normal') => {
  // 先停止之前的定时器
  stopSleepTimer()

  currentTimerMode = mode

  switch (mode) {
    case 'normal':
      // time是分钟，startTimeoutExit需要秒
      startTimeoutExit(time * 60)
      updateSetting({ 'player.timeoutExit': String(time) })
      break

    case 'fade_out':
      // 保存原始音量
      originalVolume = playerState.volume
      // 渐弱时间占总时间的30%，最少30秒
      fadeOutDuration = Math.max(30, Math.floor(time * 60 * 0.3))
      startTimeoutExit(time * 60)
      updateSetting({ 'player.timeoutExit': String(time) })

      onTimeUpdate((remainingTime) => {
        if (remainingTime <= fadeOutDuration && remainingTime > 0 && fadeOutInterval === null) {
          startFadeOutVolume()
        }
      })
      break

    case 'after_current':
      // 播放完当前歌曲后关闭
      global.lx.isPlayedStop = true
      updateSetting({ 'player.timeoutExit': '-1' })
      // 设置一个超长定时器作为兜底（30分钟）
      startTimeoutExit(1800)
      break
  }
}

/** 开始音量渐弱 */
const startFadeOutVolume = () => {
  if (fadeOutInterval !== null) return

  fadeOutStartTime = performance.now()
  const steps = 20 // 分20步减弱
  const stepInterval = (fadeOutDuration * 1000) / steps

  let currentStep = 0
  fadeOutInterval = setInterval(() => {
    currentStep++
    const progress = currentStep / steps
    const targetVolume = Math.max(0, originalVolume * (1 - progress))
    TrackPlayer.setVolume(targetVolume)
    playerState.volume = targetVolume

    if (currentStep >= steps) {
      stopFadeOut()
    }
  }, stepInterval)
}

/** 停止渐弱 */
const stopFadeOut = () => {
  if (fadeOutInterval !== null) {
    clearInterval(fadeOutInterval)
    fadeOutInterval = null
  }
  // 恢复原始音量
  TrackPlayer.setVolume(originalVolume)
  playerState.volume = originalVolume
}

/** 停止睡眠定时器 */
export const stopSleepTimer = () => {
  stopFadeOut()
  stopTimeoutExit()
  cancelTimeoutExit()
  currentTimerMode = 'normal'
  updateSetting({ 'player.timeoutExit': '' })
}

let currentTimerMode: SleepTimerMode = 'normal'

/** 获取当前睡眠定时器模式 */
export const getSleepTimerMode = (): SleepTimerMode => {
  return currentTimerMode
}

/** 获取剩余时间 */
export const getSleepTimerRemaining = (): number => {
  const { getTimeoutExitTime } = require('@/core/player/timeoutExit')
  return getTimeoutExitTime()
}