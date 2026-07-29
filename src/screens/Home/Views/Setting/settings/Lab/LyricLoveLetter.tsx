// @ts-nocheck
/**
 * 歌词情书生成器 UI
 * 选择多首歌曲，AI 生成情书
 */
import { memo, useState, useCallback, useEffect } from 'react'
import { View, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast, clipboardWriteText } from '@/utils/tools'
import playerState from '@/store/player/state'
import {
  LETTER_STYLES,
  extractRomanticLyrics,
  generateLoveLetter,
  getLetterHistory,
  deleteLetterHistoryItem,
  clearLetterHistory,
  exportLetter,
  type LetterStyle,
  type LoveLetterResult,
  type LetterHistoryItem,
} from '@/utils/lyricLoveLetter'

interface SongItem {
  id: string
  name: string
  singer: string
  lyric: string
}

export default memo(() => {
  const theme = useTheme()
  const [recipient, setRecipient] = useState('')
  const [signature, setSignature] = useState('')
  const [customNote, setCustomNote] = useState('')
  const [style, setStyle] = useState<LetterStyle>('deep')
  const [songs, setSongs] = useState<SongItem[]>([])
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<LoveLetterResult | null>(null)
  const [history, setHistory] = useState<LetterHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [previewLyrics, setPreviewLyrics] = useState<Array<{ songName: string; singer: string; lyric: string }>>([])

  const refreshHistory = useCallback(async () => {
    const h = await getLetterHistory()
    setHistory(h)
  }, [])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  // 添加当前播放歌曲
  const handleAddCurrent = useCallback(async () => {
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo) {
      Alert.alert('提示', '请先播放一首歌曲')
      return
    }
    if (songs.find((s) => s.id === musicInfo.id)) {
      toast('歌曲已在列表中')
      return
    }
    const lyric = playerState.musicInfo.lrc || playerState.musicInfo.rawlrc || ''
    setSongs([...songs, {
      id: musicInfo.id,
      name: musicInfo.name || '',
      singer: musicInfo.singer || '',
      lyric,
    }])
    toast('已添加')
  }, [songs])

  const handleRemoveSong = useCallback((id: string) => {
    setSongs(songs.filter((s) => s.id !== id))
  }, [songs])

  const handlePreviewLyrics = useCallback(() => {
    const extracted = extractRomanticLyrics(songs.map((s) => ({ songName: s.name, singer: s.singer, lyric: s.lyric })))
    setPreviewLyrics(extracted)
  }, [songs])

  const handleGenerate = useCallback(async () => {
    if (!recipient.trim()) {
      Alert.alert('提示', '请填写收信人')
      return
    }
    if (songs.length === 0) {
      Alert.alert('提示', '请至少添加一首歌曲')
      return
    }
    setGenerating(true)
    try {
      const r = await generateLoveLetter({
        recipient: recipient.trim(),
        songs: songs.map((s) => ({ id: s.id, name: s.name, singer: s.singer, lyric: s.lyric })),
        style,
        signature: signature.trim() || undefined,
        customNote: customNote.trim() || undefined,
      })
      setResult(r)
      toast('情书生成成功')
      void refreshHistory()
    } catch (e) {
      Alert.alert('生成失败', (e as Error)?.message || '未知错误')
    } finally {
      setGenerating(false)
    }
  }, [recipient, songs, style, signature, customNote, refreshHistory])

  const handleExport = useCallback(() => {
    if (!result) return
    const text = exportLetter(result)
    clipboardWriteText(text)
    toast('已复制到剪贴板')
  }, [result])

  const handleClearHistory = useCallback(() => {
    Alert.alert('确认', '清空所有情书历史？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: async () => {
          await clearLetterHistory()
          void refreshHistory()
          toast('已清空')
        },
      },
    ])
  }, [refreshHistory])

  return (
    <Section title="歌词情书生成">
      <ScrollView style={styles.container} nestedScrollEnabled>
        {/* 基本信息 */}
        <Text size={14} color={theme['c-font']} style={styles.label}>收信人</Text>
        <TextInput
          style={[styles.input, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
          value={recipient}
          onChangeText={setRecipient}
          placeholder="例如：小明"
          placeholderTextColor={theme['c-font-label']}
        />

        <Text size={14} color={theme['c-font']} style={styles.label}>署名（可选）</Text>
        <TextInput
          style={[styles.input, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
          value={signature}
          onChangeText={setSignature}
          placeholder="默认：爱你的我"
          placeholderTextColor={theme['c-font-label']}
        />

        {/* 风格选择 */}
        <Text size={14} color={theme['c-font']} style={styles.label}>情书风格</Text>
        <View style={styles.styleGrid}>
          {LETTER_STYLES.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setStyle(s.id)}
              style={[
                styles.styleCard,
                {
                  borderColor: style === s.id ? theme['c-primary'] : theme['c-primary-light-400-alpha-800'],
                  backgroundColor: style === s.id ? theme['c-primary-light-100-alpha-900'] : 'transparent',
                },
              ]}
            >
              <Text size={13} color={theme['c-font']} fontWeight="500">{s.name}</Text>
              <Text size={10} color={theme['c-font-label']}>{s.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 歌曲列表 */}
        <View style={styles.songsHeader}>
          <Text size={14} color={theme['c-font']} style={styles.label}>选择歌曲 ({songs.length})</Text>
          <TouchableOpacity onPress={handleAddCurrent} style={[styles.addSongBtn, { backgroundColor: theme['c-primary'] }]}>
            <Icon name="add-music" color="#fff" size={12} />
            <Text color="#fff" size={11} style={{ marginLeft: 4 }}>添加当前</Text>
          </TouchableOpacity>
        </View>
        {songs.length === 0 ? (
          <Text size={12} color={theme['c-font-label']} style={styles.emptyHint}>
            请添加歌曲（建议选择情歌）
          </Text>
        ) : (
          songs.map((s) => (
            <View key={s.id} style={[styles.songItem, { borderColor: theme['c-primary-light-400-alpha-800'] }]}>
              <View style={{ flex: 1 }}>
                <Text size={13} color={theme['c-font']}>{s.name}</Text>
                <Text size={11} color={theme['c-font-label']}>{s.singer}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveSong(s.id)} style={styles.removeBtn}>
                <Icon name="close" size={14} color={theme['c-liked']} />
              </TouchableOpacity>
            </View>
          ))
        )}
        {songs.length > 0 && (
          <TouchableOpacity onPress={handlePreviewLyrics} style={[styles.previewBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'] }]}>
            <Text size={12} color={theme['c-primary']}>预览将引用的歌词</Text>
          </TouchableOpacity>
        )}

        {/* 特殊要求 */}
        <Text size={14} color={theme['c-font']} style={styles.label}>特殊要求（可选）</Text>
        <TextInput
          style={[styles.input, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
          value={customNote}
          onChangeText={setCustomNote}
          placeholder="例如：包含一段具体的回忆"
          placeholderTextColor={theme['c-font-label']}
          multiline
        />

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
              <Icon name="comment" color="#fff" size={16} />
              <Text color="#fff" size={14} style={{ marginLeft: 8 }}>生成情书</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 结果展示 */}
        {result && (
          <View style={[styles.resultBox, { backgroundColor: theme['c-primary-light-100-alpha-200'], borderColor: theme['c-primary-light-400-alpha-800'] }]}>
            <View style={styles.resultHeader}>
              <Text size={14} color={theme['c-font']} fontWeight="bold">情书预览 ({result.wordCount}字)</Text>
              <TouchableOpacity onPress={handleExport} style={[styles.copyBtn, { backgroundColor: theme['c-primary'] }]}>
                <Icon name="share" color="#fff" size={12} />
                <Text color="#fff" size={11} style={{ marginLeft: 4 }}>复制</Text>
              </TouchableOpacity>
            </View>
            <Text size={13} color={theme['c-font']} style={styles.letterContent}>
              {result.content}
            </Text>
            <View style={styles.quotedBox}>
              <Text size={11} color={theme['c-font-label']} fontWeight="bold">引用歌词：</Text>
              {result.quotedLyrics.map((q, i) => (
                <Text key={i} size={11} color={theme['c-font-label']} style={styles.quotedItem}>
                  "{q.lyric}" ——《{q.songName}》
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* 历史 */}
        {history.length > 0 && (
          <View style={styles.historyBar}>
            <Text size={12} color={theme['c-font-label']}>历史 ({history.length})</Text>
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

      {/* 歌词预览弹窗 */}
      <Modal visible={previewLyrics.length > 0} transparent animationType="slide" onRequestClose={() => setPreviewLyrics([])}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme['c-content-background'] }]}>
            <View style={styles.modalHeader}>
              <Text size={16} color={theme['c-font']} fontWeight="bold">将引用的歌词</Text>
              <TouchableOpacity onPress={() => setPreviewLyrics([])}>
                <Icon name="close" size={20} color={theme['c-font-label']} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {previewLyrics.map((q, i) => (
                <View key={i} style={[styles.previewItem, { borderColor: theme['c-primary-light-400-alpha-800'] }]}>
                  <Text size={13} color={theme['c-font']} style={styles.previewLyric}>"{q.lyric}"</Text>
                  <Text size={11} color={theme['c-font-label']}>——《{q.songName}》{q.singer}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 历史弹窗 */}
      <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme['c-content-background'] }]}>
            <View style={styles.modalHeader}>
              <Text size={16} color={theme['c-font']} fontWeight="bold">情书历史</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Icon name="close" size={20} color={theme['c-font-label']} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={[styles.historyItem, { borderColor: theme['c-primary-light-400-alpha-800'] }]}>
                  <Text size={13} color={theme['c-font']}>致：{item.recipient}</Text>
                  <Text size={11} color={theme['c-font-label']} style={styles.historyPreview}>{item.preview}...</Text>
                  <Text size={10} color={theme['c-font-label']}>
                    {new Date(item.createdAt).toLocaleString('zh-CN')} · {item.wordCount}字
                  </Text>
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
  label: { marginTop: 12, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  styleCard: {
    width: '47%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  songsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addSongBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  emptyHint: {
    textAlign: 'center',
    paddingVertical: 16,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtn: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  resultBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  letterContent: {
    lineHeight: 22,
    marginBottom: 12,
  },
  quotedBox: {
    padding: 10,
    backgroundColor: 'rgba(128,128,128,0.1)',
    borderRadius: 8,
  },
  quotedItem: {
    marginTop: 4,
    fontStyle: 'italic',
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
  previewItem: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  previewLyric: {
    fontStyle: 'italic',
    marginBottom: 4,
  },
  historyItem: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  historyPreview: {
    marginTop: 4,
    marginBottom: 4,
  },
})
