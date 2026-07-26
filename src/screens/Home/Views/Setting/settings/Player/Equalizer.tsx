import { memo, useState, useCallback } from 'react'
import { View } from 'react-native'
import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import Slider from '../../components/Slider'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import {
  EQ_PRESETS,
  applyPreset,
  resetEQ,
  getCurrentEQ,
  getCurrentPreset,
  updateBand,
} from '@/utils/equalizer'

const FREQ_LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K']

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const [activePreset, setActivePreset] = useState(getCurrentPreset())
  const [bands, setBands] = useState(getCurrentEQ())
  const [enabled, setEnabled] = useState(false)

  const handlePresetChange = useCallback((presetName: string) => {
    setActivePreset(presetName)
    applyPreset(presetName)
    setBands(getCurrentEQ())
    setEnabled(true)
  }, [])

  const handleReset = useCallback(() => {
    resetEQ()
    setActivePreset('flat')
    setBands(getCurrentEQ())
    setEnabled(false)
  }, [])

  const handleBandChange = useCallback((index: number, value: number) => {
    updateBand(index, value)
    setBands(getCurrentEQ())
    setActivePreset('custom')
    setEnabled(true)
  }, [])

  return (
    <SubTitle title={t('setting_player_equalizer')}>
      <SubTitle title="预设音效">
        <View style={styles.presetRow}>
          {EQ_PRESETS.map(preset => (
            <Button
              key={preset.name}
              onPress={() => handlePresetChange(preset.name)}
            >
              {preset.label}
            </Button>
          ))}
        </View>
        <Button onPress={handleReset}>重置</Button>
      </SubTitle>

      <SubTitle title="自定义均衡器">
        {bands.map((band, index) => (
          <View key={band.frequency} style={styles.bandRow}>
            <Text size={11} style={styles.freqLabel} color={theme['c-font-label']}>
              {FREQ_LABELS[index]}
            </Text>
            <Slider
              minimumValue={-12}
              maximumValue={12}
              value={band.gain}
              step={0.5}
              onValueChange={(val: number) => handleBandChange(index, val)}
            />
            <Text size={11} style={styles.gainLabel} color={band.gain > 0 ? '#4CAF50' : band.gain < 0 ? '#F44336' : theme['c-font-label']}>
              {band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}dB
            </Text>
          </View>
        ))}
      </SubTitle>
    </SubTitle>
  )
})

const styles = createStyle({
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 10,
    marginBottom: 5,
  },
  freqLabel: {
    width: 35,
    textAlign: 'center',
  },
  gainLabel: {
    width: 50,
    textAlign: 'right',
  },
})