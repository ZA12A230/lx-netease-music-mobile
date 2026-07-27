import { memo, useState, useCallback } from 'react'
import { View } from 'react-native'
import SubTitle from '../../components/SubTitle'
import CheckBoxItem from '../../components/CheckBoxItem'
import Button from '../../components/Button'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { startSleepTimer, stopSleepTimer, type SleepTimerMode } from '@/utils/sleepTimer'
import { useTimeoutExitTimeInfo } from '@/core/player/timeoutExit'

const TIME_OPTIONS = [
  { label: '15分钟', value: 15 },
  { label: '30分钟', value: 30 },
  { label: '45分钟', value: 45 },
  { label: '60分钟', value: 60 },
  { label: '90分钟', value: 90 },
  { label: '120分钟', value: 120 },
]

const MODE_OPTIONS: { label: string; value: SleepTimerMode; desc: string }[] = [
  { label: '标准模式', value: 'normal', desc: '倒计时结束后停止播放' },
  { label: '渐弱模式', value: 'fade_out', desc: '最后阶段音量逐渐减弱至静音' },
  { label: '播完当前', value: 'after_current', desc: '播放完当前歌曲后停止' },
]

export default memo(() => {
  const t = useI18n()
  const timeoutExit = useSettingValue('player.timeoutExit')
  const isPlayedStop = useSettingValue('player.timeoutExitPlayed')
  const { time, isPlayedStop: isPlayedStopActive } = useTimeoutExitTimeInfo()
  const [selectedTime, setSelectedTime] = useState<number>(15)
  const [selectedMode, setSelectedMode] = useState<SleepTimerMode>('normal')

  const isActive = timeoutExit !== '' && timeoutExit !== '-1'

  const handleStart = useCallback(() => {
    startSleepTimer(selectedTime, selectedMode)
    const modeLabel = MODE_OPTIONS.find(m => m.value === selectedMode)?.label
    toast(`${selectedTime}分钟后停止播放（${modeLabel}）`)
  }, [selectedTime, selectedMode])

  const handleStop = useCallback(() => {
    stopSleepTimer()
    toast('已取消定时停止')
  }, [])

  const handleTogglePlayedStop = useCallback((checked: boolean) => {
    updateSetting({ 'player.timeoutExitPlayed': checked })
  }, [])

  return (
    <SubTitle title={t('setting_player_sleep_timer')}>
      <View style={styles.section}>
        {isActive ? (
          <View style={styles.activeSection}>
            <View style={styles.countdown}>
              <Button onPress={handleStop}>取消定时 (剩余 {Math.max(0, time)}秒)</Button>
            </View>
          </View>
        ) : (
          <View style={styles.inactiveSection}>
            {/* 时间选择 */}
            <View style={styles.timeOptions}>
              {TIME_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  onPress={() => setSelectedTime(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </View>

            {/* 模式选择 */}
            <View style={styles.modeOptions}>
              {MODE_OPTIONS.map(opt => (
                <CheckBoxItem
                  key={opt.value}
                  check={selectedMode === opt.value}
                  label={opt.label}
                  onChange={() => setSelectedMode(opt.value)}
                />
              ))}
            </View>

            <Button onPress={handleStart}>启动定时</Button>
          </View>
        )}

        <CheckBoxItem
          check={isPlayedStop}
          label="等待歌曲播放完毕再停止"
          onChange={handleTogglePlayedStop}
        />
      </View>
    </SubTitle>
  )
})

const styles = createStyle({
  section: {
    paddingLeft: 10,
  },
  activeSection: {
    marginBottom: 10,
  },
  inactiveSection: {
    marginBottom: 10,
  },
  countdown: {
    marginBottom: 10,
  },
  timeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  modeOptions: {
    marginBottom: 10,
  },
})