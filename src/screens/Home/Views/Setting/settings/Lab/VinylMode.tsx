// @ts-nocheck
/**
 * 黑胶唱片模式 UI
 * 复古黑胶播放界面设置
 */
import { memo, useState, useCallback, useEffect } from 'react'
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native'

import Section from '../../components/Section'
import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import {
  getVinylConfig,
  updateVinylConfig,
  resetVinylConfig,
  getRotationPerSecond,
  generateVinylNoiseParams,
  type VinylConfig,
  type VinylSpeed,
} from '@/utils/vinylMode'

export default memo(() => {
  const theme = useTheme()
  const [config, setConfig] = useState<VinylConfig | null>(null)

  useEffect(() => {
    void getVinylConfig().then(setConfig)
  }, [])

  const handleUpdate = useCallback(async (updates: Partial<VinylConfig>) => {
    if (!config) return
    const newConfig = await updateVinylConfig(updates)
    setConfig(newConfig)
  }, [config])

  const handleReset = useCallback(() => {
    Alert.alert('确认', '重置黑胶模式为默认配置？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          const c = await resetVinylConfig()
          setConfig(c)
          toast('已重置')
        },
      },
    ])
  }, [])

  if (!config) return null

  const noiseParams = generateVinylNoiseParams(config)
  const rotationPerSec = getRotationPerSecond(config.speed)

  return (
    <Section title="黑胶唱片模式">
      <ScrollView style={styles.container} nestedScrollEnabled>
        {/* 唱片预览 */}
        <View style={styles.vinylPreview}>
          <View style={[styles.vinylDisc, { transform: [{ rotate: '15deg' }] }]}>
            <View style={[styles.vinylGrooves, { borderColor: 'rgba(255,255,255,0.05)' }]} />
            <View style={styles.vinylLabel}>
              <Text size={10} color="#fff">{config.speed} RPM</Text>
            </View>
          </View>
          <View style={styles.vinylNeedle} />
        </View>

        <Text size={12} color={theme['c-font-label']} style={styles.hint}>
          黑胶唱片模式模拟复古唱机播放，启用后将在播放界面显示黑胶动画
        </Text>

        {/* 转速选择 */}
        <Text size={14} color={theme['c-font']} style={styles.label}>转速</Text>
        <View style={styles.speedRow}>
          {([
            { id: 33 as VinylSpeed, name: '33 RPM', desc: '标准转速' },
            { id: 45 as VinylSpeed, name: '45 RPM', desc: '快速' },
          ]).map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => handleUpdate({ speed: s.id })}
              style={[
                styles.speedBtn,
                {
                  borderColor: config.speed === s.id ? theme['c-primary'] : theme['c-primary-light-400-alpha-800'],
                  backgroundColor: config.speed === s.id ? theme['c-primary-light-100-alpha-900'] : 'transparent',
                },
              ]}
            >
              <Text size={14} color={theme['c-font']} fontWeight="bold">{s.name}</Text>
              <Text size={11} color={theme['c-font-label']}>{s.desc}</Text>
              <Text size={10} color={theme['c-font-label']}>{getRotationPerSecond(s.id)}°/秒</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 噪声强度 */}
        <Text size={14} color={theme['c-font']} style={styles.label}>噪声强度: {Math.round(config.noiseLevel * 100)}%</Text>
        <View style={styles.sliderRow}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => handleUpdate({ noiseLevel: v })}
              style={[
                styles.sliderBtn,
                {
                  backgroundColor: config.noiseLevel === v ? theme['c-primary'] : theme['c-primary-light-100-alpha-800'],
                },
              ]}
            >
              <Text size={10} color={config.noiseLevel === v ? '#fff' : theme['c-font']}>{Math.round(v * 100)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 磨损度 */}
        <Text size={14} color={theme['c-font']} style={styles.label}>唱片磨损度: {Math.round(config.wear * 100)}%</Text>
        <View style={styles.sliderRow}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
            <TouchableOpacity
              key={v}
              onPress={() => handleUpdate({ wear: v })}
              style={[
                styles.sliderBtn,
                {
                  backgroundColor: config.wear === v ? theme['c-primary'] : theme['c-primary-light-100-alpha-800'],
                },
              ]}
            >
              <Text size={10} color={config.wear === v ? '#fff' : theme['c-font']}>{Math.round(v * 100)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 开关项 */}
        <View style={styles.switches}>
          <CheckBoxItem
            check={config.backgroundNoise}
            onChange={(v) => handleUpdate({ backgroundNoise: v })}
            label="黑胶底噪"
            helpDesc="模拟唱机背景沙沙声和爆豆声"
          />
          <CheckBoxItem
            check={config.scratchEnabled}
            onChange={(v) => handleUpdate({ scratchEnabled: v })}
            label="刮擦音效"
            helpDesc="切歌时播放唱片刮擦声"
          />
          <CheckBoxItem
            check={config.needleDrop}
            onChange={(v) => handleUpdate({ needleDrop: v })}
            label="唱针落下音效"
            helpDesc="开始播放时模拟唱针落下的声音"
          />
        </View>

        {/* 噪声参数预览 */}
        <View style={[styles.paramsBox, { backgroundColor: theme['c-primary-light-100-alpha-200'], borderColor: theme['c-primary-light-400-alpha-800'] }]}>
          <Text size={12} color={theme['c-font']} fontWeight="bold" style={styles.paramsTitle}>噪声参数预览</Text>
          <Text size={11} color={theme['c-font-label']}>白噪强度: {(noiseParams.whiteNoise * 100).toFixed(1)}%</Text>
          <Text size={11} color={theme['c-font-label']}>爆豆频率: {noiseParams.crackleRate} 次/分钟</Text>
          <Text size={11} color={theme['c-font-label']}>爆豆强度: {(noiseParams.crackleIntensity * 100).toFixed(1)}%</Text>
          <Text size={11} color={theme['c-font-label']}>低频隆隆: {(noiseParams.rumble * 100).toFixed(1)}%</Text>
          <Text size={11} color={theme['c-font-label']}>旋转速度: {rotationPerSec}°/秒</Text>
        </View>

        {/* 重置按钮 */}
        <TouchableOpacity
          onPress={handleReset}
          style={[styles.resetBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'] }]}
        >
          <Icon name="close" size={14} color={theme['c-liked']} />
          <Text size={13} color={theme['c-liked']} style={{ marginLeft: 6 }}>重置为默认</Text>
        </TouchableOpacity>
      </ScrollView>
    </Section>
  )
})

const styles = createStyle({
  container: { paddingLeft: 25, paddingRight: 15 },
  vinylPreview: {
    alignItems: 'center',
    marginVertical: 20,
    position: 'relative',
  },
  vinylDisc: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  vinylGrooves: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 80,
    borderWidth: 2,
  },
  vinylLabel: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylNeedle: {
    position: 'absolute',
    top: 10,
    right: 30,
    width: 4,
    height: 80,
    backgroundColor: '#666',
    transform: [{ rotate: '30deg' }],
  },
  hint: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  speedRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  speedBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  sliderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  switches: {
    marginTop: 12,
  },
  paramsBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  paramsTitle: {
    marginBottom: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 16,
  },
})
