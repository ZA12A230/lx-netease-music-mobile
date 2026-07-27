import { memo, useCallback } from 'react'
import { View, ScrollView, Alert } from 'react-native'

import Section from '../../components/Section'
import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle, toast } from '@/utils/tools'
import {
  LAB_FEATURES,
  getFeaturesByCategory,
  setLabEnabled,
  toggleFeature,
  type LabFeature,
} from '@/utils/labKit'

const CATEGORY_NAMES: Record<LabFeature['category'], string> = {
  player: '播放器',
  recommendation: '推荐',
  ui: '界面',
  ai: 'AI 功能',
}

const RISK_META: Record<LabFeature['risk'], { label: string; color: string }> = {
  low: { label: '低风险', color: '#4CAF50' },
  medium: { label: '中风险', color: '#FF9800' },
  high: { label: '高风险', color: '#F44336' },
}

const FeatureItem = memo(({ feature }: { feature: LabFeature }) => {
  const theme = useTheme()
  const risk = RISK_META[feature.risk]
  const enabled = useSettingValue(feature.key as any)

  const handleToggle = useCallback((value: boolean) => {
    if (value && feature.risk !== 'low') {
      Alert.alert(
        '启用实验性功能',
        `${feature.name} 是实验性功能（${risk.label}），可能存在不稳定的情况。确定要启用吗？\n\n${feature.description}`,
        [
          { text: '取消', style: 'cancel' },
          { text: '确定启用', onPress: () => { void toggleFeature(feature.key, true) } },
        ]
      )
    } else {
      void toggleFeature(feature.key, value)
    }
  }, [feature, risk])

  return (
    <View style={[styles.featureItem, {
      borderColor: enabled ? theme['c-primary'] : 'transparent',
      backgroundColor: theme['c-primary-light-100-alpha-200'],
    }]}>
      <View style={styles.featureHeader}>
        <Text size={20}>{feature.icon}</Text>
        <View style={styles.featureTitleWrap}>
          <Text size={14} color={theme['c-font']} style={styles.featureName}>{feature.name}</Text>
          <View style={[styles.riskBadge, { backgroundColor: risk.color + '30' }]}>
            <Text size={10} color={risk.color}>{risk.label}</Text>
          </View>
        </View>
        <CheckBoxItem check={enabled} onChange={handleToggle} />
      </View>
      <Text size={12} color={theme['c-font-label']} style={styles.featureDesc}>
        {feature.description}
      </Text>
    </View>
  )
})

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const labEnabled = useSettingValue('lab.enabled')

  const handleToggleLab = useCallback((enabled: boolean) => {
    if (enabled) {
      Alert.alert(
        '启用实验室功能',
        '实验室功能包含正在测试中的实验性特性，可能存在不稳定或性能问题。确定要启用吗？',
        [
          { text: '取消', style: 'cancel' },
          { text: '确定', onPress: () => { void setLabEnabled(true); toast('实验室已启用') } },
        ]
      )
    } else {
      Alert.alert(
        '禁用实验室',
        '禁用后将关闭所有实验性功能。确定吗？',
        [
          { text: '取消', style: 'cancel' },
          { text: '确定', onPress: () => { void setLabEnabled(false); toast('实验室已禁用') } },
        ]
      )
    }
  }, [])

  const grouped = getFeaturesByCategory()

  return (
    <Section title={t('setting_lab') || '实验室'}>
      <View style={styles.section}>
        <CheckBoxItem
          check={labEnabled}
          onChange={handleToggleLab}
          label="启用实验室功能"
          helpDesc="实验室包含正在测试中的实验性特性，可能存在不稳定情况"
        />
      </View>

      {labEnabled ? (
        <ScrollView style={styles.featuresScroll} nestedScrollEnabled>
          {(Object.entries(grouped) as Array<[LabFeature['category'], LabFeature[]]>).map(([category, features]) => (
            features.length > 0 ? (
              <View key={category} style={styles.categorySection}>
                <Text size={14} color={theme['c-primary']} style={styles.categoryTitle}>
                  {CATEGORY_NAMES[category]}
                </Text>
                {features.map((feature) => (
                  <FeatureItem
                    key={feature.key}
                    feature={feature}
                  />
                ))}
              </View>
            ) : null
          ))}

          <View style={[styles.warningBox, { backgroundColor: theme['c-primary-light-100-alpha-200'], borderColor: theme['c-primary-light-400-alpha-400'] }]}>
            <Text size={12} color={theme['c-font-label']}>
              ⚠️ 实验性功能可能存在不稳定情况，如遇到问题请关闭对应功能或在设置中重置。{'\n\n'}
              💡 欢迎通过反馈渠道向我们报告问题，帮助我们改进功能。
            </Text>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.disabledHint}>
          <Text size={13} color={theme['c-font-label']}>
            启用实验室以体验正在开发的实验性功能
          </Text>
        </View>
      )}
    </Section>
  )
})

const styles = createStyle({
  section: {
    marginTop: 10,
    paddingLeft: 25,
    paddingRight: 15,
  },
  featuresScroll: {
    paddingLeft: 25,
    paddingRight: 15,
  },
  categorySection: {
    marginTop: 12,
  },
  categoryTitle: {
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
    fontWeight: 'bold',
  },
  featureName: {
    fontWeight: '500',
  },
  featureItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  featureDesc: {
    marginTop: 4,
    lineHeight: 18,
  },
  warningBox: {
    marginTop: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  disabledHint: {
    padding: 25,
    alignItems: 'center',
  },
})
