// @ts-nocheck
/**
 * 歌词壁纸生成器 UI
 * 选择歌曲和风格，生成精美壁纸
 */
import { memo, useState, useCallback, useEffect } from 'react'
import { View, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, FlatList, Modal } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import playerState from '@/store/player/state'
import {
  WALLPAPER_STYLES,
  extractHighlightLyric,
  generateWallpaper,
  getWallpaperHistory,
  clearWallpaperHistory,
  type WallpaperStyle,
  type WallpaperResult,
  type WallpaperHistoryItem,
} from '@/utils/lyricWallpaper'

const SCREEN_WIDTH = 1080
const SCREEN_HEIGHT = 1920

export default memo(() => {
  const theme = useTheme()
  const [lyric, setLyric] = useState('')
  const [songName, setSongName] = useState('')
  const [singer, setSinger] = useState('')
  const [style, setStyle] = useState<WallpaperStyle>('dark')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<WallpaperResult | null>(null)
  const [history, setHistory] = useState<WallpaperHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    void refreshHistory()
    // 自动填充当前播放歌曲
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (musicInfo) {
      setSongName(musicInfo.name || '')
      setSinger(musicInfo.singer || '')
      const lrc = playerState.musicInfo.lrc || playerState.musicInfo.rawlrc || ''
      if (lrc) setLyric(lrc)
    }
  }, [])

  const refreshHistory = useCallback(async () => {
    const h = await getWallpaperHistory()
    setHistory(h)
  }, [])

  const handleExtract = useCallback(() => {
    if (!lyric) {
      toast('请先输入或加载歌词')
      return
    }
    const highlights = extractHighlightLyric(lyric)
    if (highlights.length > 0) {
      setLyric(highlights.join('\n'))
      toast('已提取歌词精华')
    } else {
      toast('未找到合适的歌词精华句')
    }
  }, [lyric])

  const handleGenerate = useCallback(() => {
    if (!lyric.trim() || !songName.trim()) {
      Alert.alert('提示', '请填写歌词和歌曲名')
      return
    }
    setGenerating(true)
    setTimeout(() => {
      try {
        const r = generateWallpaper({
          lyric: lyric.trim(),
          songName: songName.trim(),
          singer: singer.trim() || '未知歌手',
          style,
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
        })
        setResult(r)
        toast('壁纸生成成功')
        void refreshHistory()
      } catch (e) {
        Alert.alert('生成失败', (e as Error)?.message || '未知错误')
      } finally {
        setGenerating(false)
      }
    }, 200)
  }, [lyric, songName, singer, style])

  const handleClearHistory = useCallback(() => {
    Alert.alert('确认', '确定清空所有壁纸历史吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: async () => {
          await clearWallpaperHistory()
          void refreshHistory()
          toast('已清空')
        },
      },
    ])
  }, [])

  return (
    <Section title="歌词壁纸生成器">
      <ScrollView style={styles.container} nestedScrollEnabled>
        {/* 输入区 */}
        <View style={styles.inputSection}>
          <Text size={14} color={theme['c-font']} style={styles.label}>歌曲名</Text>
          <TextInput
            style={[styles.input, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
            value={songName}
            onChangeText={setSongName}
            placeholder="输入歌曲名"
            placeholderTextColor={theme['c-font-label']}
          />

          <Text size={14} color={theme['c-font']} style={styles.label}>歌手</Text>
          <TextInput
            style={[styles.input, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
            value={singer}
            onChangeText={setSinger}
            placeholder="输入歌手名"
            placeholderTextColor={theme['c-font-label']}
          />

          <View style={styles.lyricHeader}>
            <Text size={14} color={theme['c-font']} style={styles.label}>歌词</Text>
            <TouchableOpacity onPress={handleExtract} style={[styles.extractBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'] }]}>
              <Text size={12} color={theme['c-primary']}>提取精华</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.lyricInput, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
            value={lyric}
            onChangeText={setLyric}
            placeholder="粘贴或输入歌词..."
            placeholderTextColor={theme['c-font-label']}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* 风格选择 */}
        <Text size={14} color={theme['c-font']} style={styles.label}>选择风格</Text>
        <View style={styles.styleGrid}>
          {WALLPAPER_STYLES.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setStyle(s.id)}
              style={[
                styles.styleItem,
                {
                  borderColor: style === s.id ? theme['c-primary'] : theme['c-primary-light-400-alpha-800'],
                  backgroundColor: style === s.id ? theme['c-primary-light-100-alpha-900'] : 'transparent',
                },
              ]}
            >
              <View style={[styles.stylePreview, { backgroundColor: s.bgColors[0] }]}>
                {s.bgColors.length > 1 && (
                  <View style={[styles.stylePreview2, { backgroundColor: s.bgColors[1] }]} />
                )}
              </View>
              <Text size={11} color={theme['c-font']}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 生成按钮 */}
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={generating}
          style={[styles.generateBtn, { backgroundColor: generating ? theme['c-primary-light-400-alpha-600'] : theme['c-primary'] }]}
        >
          {generating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Icon name="add-music" color="#fff" size={16} />
              <Text color="#fff" size={14} style={{ marginLeft: 8 }}>生成壁纸</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 预览结果 */}
        {result && (
          <View style={styles.previewSection}>
            <Text size={14} color={theme['c-font']} style={styles.label}>预览</Text>
            <View style={[styles.previewWrap, { borderColor: theme['c-primary-light-400-alpha-800'] }]}>
              <Image
                source={{ uri: result.dataUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </View>
            <Text size={11} color={theme['c-font-label']} style={styles.hint}>
              长按图片可保存到相册（需相册权限）
            </Text>
          </View>
        )}

        {/* 历史记录入口 */}
        {history.length > 0 && (
          <View style={styles.historyBar}>
            <Text size={12} color={theme['c-font-label']}>历史记录 ({history.length})</Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => setShowHistory(true)} style={[styles.historyBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'] }]}>
                <Text size={12} color={theme['c-primary']}>查看</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClearHistory} style={[styles.historyBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'], marginLeft: 8 }]}>
                <Text size={12} color={theme['c-liked']}>清空</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 历史记录弹窗 */}
      <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme['c-content-background'] }]}>
            <View style={styles.modalHeader}>
              <Text size={16} color={theme['c-font']} fontWeight="bold">壁纸历史</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Icon name="close" size={20} color={theme['c-font-label']} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={[styles.historyItem, { borderColor: theme['c-primary-light-400-alpha-800'] }]}>
                  <Text size={13} color={theme['c-font']}>{item.songName} - {item.singer}</Text>
                  <Text size={11} color={theme['c-font-label']} style={styles.historyLyric}>{item.lyric.slice(0, 40)}</Text>
                  <Text size={10} color={theme['c-font-label']}>{new Date(item.createdAt).toLocaleString('zh-CN')}</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </Section>
  )
})

const styles = createStyle({
  container: { paddingLeft: 25, paddingRight: 15 },
  inputSection: { marginTop: 10 },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  lyricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  extractBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lyricInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 100,
    maxHeight: 200,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  styleItem: {
    width: 70,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  stylePreview: {
    width: 50,
    height: 80,
    borderRadius: 6,
    marginBottom: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  stylePreview2: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    bottom: 0,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  previewSection: { marginTop: 8 },
  previewWrap: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1080 / 1920,
    maxHeight: 400,
  },
  hint: {
    marginTop: 8,
    textAlign: 'center',
  },
  historyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 16,
  },
  historyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
    maxHeight: '80%',
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
  historyItem: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  historyLyric: {
    marginTop: 4,
    marginBottom: 4,
    fontStyle: 'italic',
  },
})
