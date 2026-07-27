import { memo, useState, useCallback } from 'react'
import { View, ScrollView, Alert, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'

import Section from '../../components/Section'
import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle, toast } from '@/utils/tools'
import {
  clearAllLogs,
  testNetworkRequest,
  exportDebugInfo,
  enableDevMode,
  disableDevMode,
} from '@/utils/devKit'
import { getPerformanceReport, resetPerformanceMetrics } from '@/utils/performanceMonitor'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const devEnabled = useSettingValue('developer.enabled')
  const showPerfOverlay = useSettingValue('developer.showPerformanceOverlay')
  const showLogOverlay = useSettingValue('developer.showLogOverlay')
  const verboseLog = useSettingValue('developer.verboseLog')
  const networkInspector = useSettingValue('developer.enableNetworkInspector')
  const crashReport = useSettingValue('developer.crashReport')
  const debugMode = useSettingValue('developer.debugMode')

  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [testUrl, setTestUrl] = useState('https://www.baidu.com')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const handleToggleDev = useCallback(async (enabled: boolean) => {
    if (enabled) {
      Alert.alert(
        '启用开发者模式',
        '开发者模式提供高级调试功能，可能影响应用性能。确定要启用吗？',
        [
          { text: '取消', style: 'cancel' },
          { text: '确定', onPress: async () => { await enableDevMode() } },
        ]
      )
    } else {
      await disableDevMode()
    }
  }, [])

  const handleGetSnapshot = useCallback(async () => {
    setLoading(true)
    try {
      const data = await exportDebugInfo()
      setSnapshot(data)
      toast('调试快照已生成')
    } catch (e: any) {
      toast(`生成失败: ${e?.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleClearLogs = useCallback(async () => {
    Alert.alert('确认清空', '将清空所有日志和性能数据，确定吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: async () => {
          await clearAllLogs()
          setSnapshot(null)
          toast('已清空所有日志')
        },
      },
    ])
  }, [])

  const handleNetworkTest = useCallback(async () => {
    if (!testUrl.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testNetworkRequest(testUrl.trim())
      if (result.ok) {
        setTestResult(`✓ 成功\n状态码: ${result.status}\n耗时: ${result.duration}ms\n大小: ${result.size} bytes`)
      } else {
        setTestResult(`✗ 失败\n状态码: ${result.status}\n耗时: ${result.duration}ms\n错误: ${result.error || '未知'}`)
      }
    } catch (e: any) {
      setTestResult(`✗ 异常: ${e?.message}`)
    } finally {
      setTesting(false)
    }
  }, [testUrl])

  const handleResetPerf = useCallback(() => {
    resetPerformanceMetrics()
    toast('性能数据已重置')
  }, [])

  const report = getPerformanceReport()
  const apiCount = Object.keys(report.apis).length
  const screenCount = Object.keys(report.screens).length

  return (
    <Section title={t('setting_developer') || '开发者模式'}>
      <View style={styles.section}>
        <CheckBoxItem
          check={devEnabled}
          onChange={handleToggleDev}
          label="启用开发者模式"
          helpDesc="启用后可访问调试、性能监控、日志等高级功能"
        />
      </View>

      {devEnabled ? (
        <>
          <View style={styles.section}>
            <Text size={14} color={theme['c-font-label']} style={styles.subTitle}>
              调试选项
            </Text>
            <CheckBoxItem
              check={showPerfOverlay}
              onChange={(v) => updateSetting({ 'developer.showPerformanceOverlay': v })}
              label="显示性能浮层"
              helpDesc="在屏幕上方显示实时性能数据"
            />
            <CheckBoxItem
              check={showLogOverlay}
              onChange={(v) => updateSetting({ 'developer.showLogOverlay': v })}
              label="显示日志浮层"
              helpDesc="实时显示应用日志"
            />
            <CheckBoxItem
              check={verboseLog}
              onChange={(v) => updateSetting({ 'developer.verboseLog': v })}
              label="详细日志模式"
              helpDesc="输出更详细的调试信息，可能影响性能"
            />
            <CheckBoxItem
              check={networkInspector}
              onChange={(v) => updateSetting({ 'developer.enableNetworkInspector': v })}
              label="网络检查器"
              helpDesc="拦截并显示所有网络请求"
            />
            <CheckBoxItem
              check={crashReport}
              onChange={(v) => updateSetting({ 'developer.crashReport': v })}
              label="崩溃报告"
              helpDesc="应用崩溃时自动收集报告"
            />
            <CheckBoxItem
              check={debugMode}
              onChange={(v) => updateSetting({ 'developer.debugMode': v })}
              label="调试模式"
              helpDesc="启用额外的调试断言和检查"
            />
          </View>

          <View style={styles.section}>
            <Text size={14} color={theme['c-font-label']} style={styles.subTitle}>
              性能监控
            </Text>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme['c-primary-light-100-alpha-400'] }]}>
                <Text size={20} color={theme['c-primary']} style={styles.boldText}>{screenCount}</Text>
                <Text size={11} color={theme['c-font-label']}>屏幕数</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme['c-primary-light-100-alpha-400'] }]}>
                <Text size={20} color={theme['c-primary']} style={styles.boldText}>{apiCount}</Text>
                <Text size={11} color={theme['c-font-label']}>API 数</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme['c-primary-light-100-alpha-400'] }]}>
                <Text size={20} color={theme['c-primary']} style={styles.boldText}>{report.interactions.count}</Text>
                <Text size={11} color={theme['c-font-label']}>交互数</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleResetPerf} style={[styles.actionBtn, { borderColor: theme['c-primary-light-400-alpha-400'] }]}>
              <Text size={13} color={theme['c-font']}>重置性能数据</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text size={14} color={theme['c-font-label']} style={styles.subTitle}>
              网络测试
            </Text>
            <TextInput
              style={[styles.input, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-400'], backgroundColor: theme['c-primary-light-100-alpha-200'] }]}
              value={testUrl}
              onChangeText={setTestUrl}
              placeholder="输入测试 URL"
              placeholderTextColor={theme['c-font-label']}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={handleNetworkTest} disabled={testing} style={[styles.actionBtn, { borderColor: theme['c-primary-light-400-alpha-400'] }]}>
              {testing ? (
                <View style={styles.rowCenter}>
                  <ActivityIndicator color={theme['c-font']} size="small" />
                  <Text size={13} color={theme['c-font']} style={{ marginLeft: 8 }}>测试中...</Text>
                </View>
              ) : (
                <Text size={13} color={theme['c-font']}>开始测试</Text>
              )}
            </TouchableOpacity>
            {testResult ? (
              <View style={[styles.resultBox, { backgroundColor: theme['c-primary-light-100-alpha-200'], borderColor: theme['c-primary-light-400-alpha-400'] }]}>
                <Text size={12} color={theme['c-font']}>{testResult}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text size={14} color={theme['c-font-label']} style={styles.subTitle}>
              调试工具
            </Text>
            <TouchableOpacity onPress={handleGetSnapshot} disabled={loading} style={[styles.actionBtn, { borderColor: theme['c-primary-light-400-alpha-400'] }]}>
              {loading ? (
                <View style={styles.rowCenter}>
                  <ActivityIndicator color={theme['c-font']} size="small" />
                  <Text size={13} color={theme['c-font']} style={{ marginLeft: 8 }}>生成中...</Text>
                </View>
              ) : (
                <Text size={13} color={theme['c-font']}>生成调试快照</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearLogs} style={[styles.actionBtn, { borderColor: theme['c-primary-light-400-alpha-400'] }]}>
              <Text size={13} color={theme['c-font']}>清空所有日志</Text>
            </TouchableOpacity>
            {snapshot ? (
              <View style={[styles.snapshotBox, { backgroundColor: theme['c-primary-light-100-alpha-200'], borderColor: theme['c-primary-light-400-alpha-400'] }]}>
                <Text size={11} color={theme['c-font-label']} style={styles.snapshotHeader}>
                  调试快照（部分内容）:
                </Text>
                <ScrollView style={styles.snapshotScroll} nestedScrollEnabled>
                  <Text size={10} color={theme['c-font']} style={styles.snapshotText}>
                    {snapshot.slice(0, 2000)}
                    {snapshot.length > 2000 ? '\n... (内容过长已截断)' : ''}
                  </Text>
                </ScrollView>
              </View>
            ) : null}
          </View>
        </>
      ) : (
        <View style={styles.disabledHint}>
          <Text size={13} color={theme['c-font-label']}>
            启用开发者模式以解锁高级功能
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
  subTitle: {
    marginBottom: 8,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  boldText: {
    fontWeight: 'bold',
  },
  actionBtn: {
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 8,
  },
  resultBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapshotBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    maxHeight: 250,
  },
  snapshotHeader: {
    marginBottom: 6,
    fontWeight: '500',
  },
  snapshotScroll: {
    maxHeight: 200,
  },
  snapshotText: {
    fontFamily: 'monospace',
  },
  disabledHint: {
    padding: 25,
    alignItems: 'center',
  },
})
