import { memo, useState, useCallback, useEffect } from 'react'
import { View, ScrollView, ActivityIndicator } from 'react-native'
import SubTitle from '../../components/SubTitle'
import Button from '../../components/Button'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import Text from '@/components/common/Text'
import { generateStatsReport, formatDuration, type StatsReport } from '@/utils/statsReport'

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const [report, setReport] = useState<StatsReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState<'week' | 'month'>('week')

  const handleGenerate = useCallback(async (selectedRange: 'week' | 'month') => {
    setLoading(true)
    setRange(selectedRange)
    try {
      const result = await generateStatsReport(selectedRange)
      if (result) {
        setReport(result)
      } else {
        toast('该时间段内暂无播放记录')
        setReport(null)
      }
    } catch (error: any) {
      toast(`生成报告失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <SubTitle title={t('setting_player_stats')}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme['c-primary-font']} />
          <Text size={14} color={theme['c-font-label']} style={styles.loadingText}>正在生成报告...</Text>
        </View>
      </SubTitle>
    )
  }

  return (
    <SubTitle title={t('setting_player_stats')}>
      <View style={styles.btnRow}>
        <Button onPress={() => handleGenerate('week')}>周报</Button>
        <Button onPress={() => handleGenerate('month')}>月报</Button>
      </View>

      {report ? (
        <ScrollView style={styles.report}>
          <SubTitle title={`${range === 'week' ? '周报' : '月报'} (${report.startDate} ~ ${report.endDate})`}>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text size={20} color={theme['c-primary-font']}>{report.totalPlays}</Text>
                <Text size={11} color={theme['c-font-label']}>总播放次数</Text>
              </View>
              <View style={styles.statItem}>
                <Text size={20} color={theme['c-primary-font']}>{formatDuration(report.totalTime)}</Text>
                <Text size={11} color={theme['c-font-label']}>总时长</Text>
              </View>
              <View style={styles.statItem}>
                <Text size={20} color={theme['c-primary-font']}>{report.uniqueSongs}</Text>
                <Text size={11} color={theme['c-font-label']}>不同歌曲</Text>
              </View>
              <View style={styles.statItem}>
                <Text size={20} color={theme['c-primary-font']}>{report.uniqueArtists}</Text>
                <Text size={11} color={theme['c-font-label']}>不同歌手</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text size={20} color={theme['c-primary-font']}>{report.dailyAverage}</Text>
                <Text size={11} color={theme['c-font-label']}>日均播放</Text>
              </View>
            </View>
          </SubTitle>

          <SubTitle title="Top 10 歌曲">
            {report.topSongs.map((song, i) => (
              <View key={i} style={styles.rankRow}>
                <Text size={12} color={theme['c-font-label']} style={styles.rankNum}>
                  {i + 1}.
                </Text>
                <Text size={13} style={styles.rankText} numberOfLines={1}>
                  {song.name} - {song.singer}
                </Text>
                <Text size={11} color={theme['c-font-label']}>
                  {song.count}次
                </Text>
              </View>
            ))}
          </SubTitle>

          <SubTitle title="Top 10 歌手">
            {report.topArtists.map((artist, i) => (
              <View key={i} style={styles.rankRow}>
                <Text size={12} color={theme['c-font-label']} style={styles.rankNum}>
                  {i + 1}.
                </Text>
                <Text size={13} style={styles.rankText} numberOfLines={1}>
                  {artist.name}
                </Text>
                <Text size={11} color={theme['c-font-label']}>
                  {artist.count}次 | {formatDuration(artist.totalTime)}
                </Text>
              </View>
            ))}
          </SubTitle>
        </ScrollView>
      ) : (
        <Text size={13} color={theme['c-font-label']} style={styles.emptyText}>
          点击「周报」或「月报」查看播放统计
        </Text>
      )}
    </SubTitle>
  )
})

const styles = createStyle({
  loading: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
  },
  btnRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  report: {
    maxHeight: 500,
  },
  statRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    paddingVertical: 3,
  },
  rankNum: {
    width: 25,
  },
  rankText: {
    flex: 1,
    marginRight: 10,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
  },
})