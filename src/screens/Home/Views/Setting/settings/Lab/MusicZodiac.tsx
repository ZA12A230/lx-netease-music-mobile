// @ts-nocheck
/**
 * 音乐星座 UI
 * 分析听歌习惯，生成音乐星座和性格分析
 */
import { memo, useState, useCallback, useEffect } from 'react'
import { View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import {
  MUSIC_ZODIAC_SIGNS,
  analyzeMusicZodiac,
  getCompatibility,
  getZodiacHistory,
  type ZodiacAnalysisResult,
  type ZodiacHistoryItem,
} from '@/utils/musicZodiac'
import { getPlayHistory } from '@/utils/playHistoryManager'

export default memo(() => {
  const theme = useTheme()
  const [result, setResult] = useState<ZodiacAnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [history, setHistory] = useState<ZodiacHistoryItem[]>([])
  const [showAllSigns, setShowAllSigns] = useState(false)
  const [selectedSign, setSelectedSign] = useState<string | null>(null)

  const refreshHistory = useCallback(async () => {
    const h = await getZodiacHistory()
    setHistory(h)
  }, [])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true)
    try {
      const playHistory = await getPlayHistory(100)
      const r = await analyzeMusicZodiac(playHistory)
      setResult(r)
      toast('分析完成')
      void refreshHistory()
    } catch (e) {
      Alert.alert('分析失败', (e as Error)?.message || '未知错误')
    } finally {
      setAnalyzing(false)
    }
  }, [refreshHistory])

  return (
    <Section title="音乐星座">
      <ScrollView style={styles.container} nestedScrollEnabled>
        {/* 分析按钮 */}
        <TouchableOpacity
          onPress={handleAnalyze}
          disabled={analyzing}
          style={[styles.analyzeBtn, { backgroundColor: theme['c-primary'] }]}
        >
          {analyzing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Icon name="logo" color="#fff" size={16} />
              <Text color="#fff" size={14} style={{ marginLeft: 8 }}>分析我的音乐星座</Text>
            </>
          )}
        </TouchableOpacity>

        <Text size={12} color={theme['c-font-label']} style={styles.hint}>
          基于最近 100 首播放记录分析，生成你的专属音乐星座
        </Text>

        {/* 分析结果 */}
        {result && (
          <View style={[styles.resultBox, { backgroundColor: theme['c-primary-light-100-alpha-200'], borderColor: result.sign.color }]}>
            <View style={[styles.signHeader, { backgroundColor: result.sign.color }]}>
              <Text size={40} color="#fff">{result.sign.symbol}</Text>
              <Text size={20} color="#fff" fontWeight="bold">{result.sign.name}</Text>
              <Text size={11} color="rgba(255,255,255,0.8)">{result.sign.dates}</Text>
            </View>

            <View style={styles.signBody}>
              <Text size={13} color={theme['c-font']} style={styles.signDesc}>{result.sign.description}</Text>

              {/* 性格特征 */}
              <Text size={13} color={theme['c-font']} fontWeight="bold" style={styles.sectionTitle}>性格特征</Text>
              <View style={styles.traitsRow}>
                {result.sign.traits.map((trait) => (
                  <View key={trait} style={[styles.traitBadge, { backgroundColor: result.sign.color + '30' }]}>
                    <Text size={11} color={result.sign.color}>{trait}</Text>
                  </View>
                ))}
              </View>

              {/* 评分 */}
              <Text size={13} color={theme['c-font']} fontWeight="bold" style={styles.sectionTitle}>音乐人格评分</Text>
              <ScoreBar label="能量值" value={result.scores.energy} color="#FF4444" />
              <ScoreBar label="情感值" value={result.scores.emotion} color="#2196F3" />
              <ScoreBar label="复杂度" value={result.scores.complexity} color="#9C27B0" />
              <ScoreBar label="主流度" value={result.scores.popularity} color="#FF9800" />
              <ScoreBar label="多样性" value={result.scores.diversity} color="#4CAF50" />

              {/* 元素分布 */}
              <Text size={13} color={theme['c-font']} fontWeight="bold" style={styles.sectionTitle}>元素分布</Text>
              <View style={styles.elementRow}>
                {([
                  { name: '火', value: result.elementDistribution.fire, color: '#FF4444' },
                  { name: '土', value: result.elementDistribution.earth, color: '#8D6E63' },
                  { name: '风', value: result.elementDistribution.air, color: '#00D9FF' },
                  { name: '水', value: result.elementDistribution.water, color: '#2196F3' },
                ]).map((e) => (
                  <View key={e.name} style={styles.elementItem}>
                    <Text size={20} color={e.color}>{e.name}</Text>
                    <Text size={11} color={theme['c-font']}>{e.value}%</Text>
                  </View>
                ))}
              </View>

              {/* 幸运流派 */}
              <Text size={13} color={theme['c-font']} fontWeight="bold" style={styles.sectionTitle}>幸运音乐风格</Text>
              <View style={styles.traitsRow}>
                {result.sign.luckyGenres.map((g) => (
                  <View key={g} style={[styles.traitBadge, { backgroundColor: theme['c-primary-light-400-alpha-600'] }]}>
                    <Text size={11} color={theme['c-font']}>{g}</Text>
                  </View>
                ))}
              </View>

              {/* 偏好关键词 */}
              {result.preferenceKeywords.length > 0 && (
                <>
                  <Text size={13} color={theme['c-font']} fontWeight="bold" style={styles.sectionTitle}>偏好关键词</Text>
                  <View style={styles.traitsRow}>
                    {result.preferenceKeywords.map((k) => (
                      <View key={k} style={[styles.traitBadge, { backgroundColor: theme['c-primary-light-400-alpha-600'] }]}>
                        <Text size={11} color={theme['c-font']}>{k}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text size={10} color={theme['c-font-label']} style={styles.sampleInfo}>
                样本量：{result.sampleSize} 首 · 分析时间：{new Date(result.analyzedAt).toLocaleString('zh-CN')}
              </Text>
            </View>
          </View>
        )}

        {/* 历史记录 */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text size={13} color={theme['c-font']} fontWeight="bold" style={styles.sectionTitle}>历史分析</Text>
            {history.slice(0, 5).map((h) => (
              <View key={h.id} style={[styles.historyItem, { borderColor: theme['c-primary-light-400-alpha-800'] }]}>
                <Text size={12} color={theme['c-font']}>{h.signName}</Text>
                <Text size={10} color={theme['c-font-label']}>
                  {new Date(h.analyzedAt).toLocaleDateString('zh-CN')} · {h.sampleSize}首
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 查看所有星座 */}
        <TouchableOpacity
          onPress={() => setShowAllSigns(true)}
          style={[styles.allSignsBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'] }]}
        >
          <Icon name="list-loop" color={theme['c-primary']} size={14} />
          <Text size={13} color={theme['c-primary']} style={{ marginLeft: 6 }}>查看12星座</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 所有星座弹窗 */}
      <Modal visible={showAllSigns} transparent animationType="slide" onRequestClose={() => { setShowAllSigns(false); setSelectedSign(null) }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme['c-content-background'] }]}>
            <View style={styles.modalHeader}>
              <Text size={16} color={theme['c-font']} fontWeight="bold">12 音乐星座</Text>
              <TouchableOpacity onPress={() => { setShowAllSigns(false); setSelectedSign(null) }}>
                <Icon name="close" size={20} color={theme['c-font-label']} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.signsList}>
              {MUSIC_ZODIAC_SIGNS.map((sign) => (
                <TouchableOpacity
                  key={sign.id}
                  onPress={() => setSelectedSign(selectedSign === sign.id ? null : sign.id)}
                  style={[styles.signItem, { borderColor: sign.color + '60' }]}
                >
                  <View style={[styles.signItemHeader, { backgroundColor: sign.color }]}>
                    <Text size={24} color="#fff">{sign.symbol}</Text>
                    <View>
                      <Text size={14} color="#fff" fontWeight="bold">{sign.name}</Text>
                      <Text size={10} color="rgba(255,255,255,0.8)">{sign.dates}</Text>
                    </View>
                  </View>
                  {selectedSign === sign.id && (
                    <View style={styles.signDetail}>
                      <Text size={12} color={theme['c-font']}>{sign.description}</Text>
                      <View style={styles.traitsRow}>
                        {sign.traits.map((t) => (
                          <View key={t} style={[styles.traitBadge, { backgroundColor: sign.color + '20' }]}>
                            <Text size={10} color={sign.color}>{t}</Text>
                          </View>
                        ))}
                      </View>
                      <Text size={11} color={theme['c-font-label']}>幸运风格: {sign.luckyGenres.join('、')}</Text>
                      {result && (
                        <View style={styles.compatBox}>
                          <Text size={11} color={theme['c-font']}>
                            与你的星座({result.sign.name}): {getCompatibility(result.sign.id, sign.id).desc}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Section>
  )
})

const ScoreBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={styles.scoreRow}>
    <Text size={11} color="#666" style={styles.scoreLabel}>{label}</Text>
    <View style={styles.scoreTrack}>
      <View style={[styles.scoreFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
    <Text size={11} color="#666" style={styles.scoreValue}>{value}</Text>
  </View>
)

const styles = createStyle({
  container: { paddingLeft: 25, paddingRight: 15 },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  hint: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  resultBox: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  signHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  signBody: {
    padding: 14,
  },
  signDesc: {
    lineHeight: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 8,
  },
  traitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  traitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreLabel: {
    width: 60,
  },
  scoreTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(128,128,128,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    width: 30,
    textAlign: 'right',
  },
  elementRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  elementItem: {
    alignItems: 'center',
  },
  sampleInfo: {
    marginTop: 12,
    textAlign: 'center',
  },
  historySection: {
    marginTop: 8,
    marginBottom: 16,
  },
  historyItem: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  allSignsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  signsList: {
    maxHeight: 500,
  },
  signItem: {
    borderWidth: 1.5,
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  signItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
  },
  signDetail: {
    padding: 12,
  },
  compatBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(128,128,128,0.1)',
    borderRadius: 6,
  },
})
