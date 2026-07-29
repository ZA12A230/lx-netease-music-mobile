// @ts-nocheck
/**
 * 音乐相册 UI
 * 管理照片-歌曲关联，查看那年今日回忆
 */
import { memo, useState, useCallback, useEffect } from 'react'
import { View, ScrollView, TextInput, TouchableOpacity, Alert, FlatList, Image, Modal } from 'react-native'

import Section from '../../components/Section'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import playerState from '@/store/player/state'
import {
  createPhotoLink,
  getAllPhotoLinks,
  deletePhotoLink,
  getMemoriesOnThisDay,
  getAvailableMemoryYears,
  getPhotoLinksTimeline,
  type PhotoLink,
} from '@/utils/musicAlbum'

export default memo(() => {
  const theme = useTheme()
  const [links, setLinks] = useState<PhotoLink[]>([])
  const [memories, setMemories] = useState<PhotoLink[]>([])
  const [memoryYears, setMemoryYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState(1)
  const [timeline, setTimeline] = useState<Array<{ month: string; links: PhotoLink[] }>>([])
  const [showAdd, setShowAdd] = useState(false)
  const [note, setNote] = useState('')
  const [photoUri, setPhotoUri] = useState('')
  const [view, setView] = useState<'memories' | 'timeline' | 'all'>('memories')

  const refresh = useCallback(async () => {
    const [allLinks, mem, years, tl] = await Promise.all([
      getAllPhotoLinks(),
      getMemoriesOnThisDay(1),
      getAvailableMemoryYears(),
      getPhotoLinksTimeline(),
    ])
    setLinks(allLinks)
    setMemories(mem)
    setMemoryYears(years)
    setTimeline(tl)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleAdd = useCallback(async () => {
    if (!photoUri) {
      toast('请选择照片')
      return
    }
    const musicInfo = playerState.playMusicInfo.musicInfo
    if (!musicInfo) {
      Alert.alert('提示', '请先播放一首歌曲再添加关联')
      return
    }
    await createPhotoLink(
      photoUri,
      { id: musicInfo.id, name: musicInfo.name, singer: musicInfo.singer || '未知' },
      note
    )
    setPhotoUri('')
    setNote('')
    setShowAdd(false)
    toast('添加成功')
    void refresh()
  }, [photoUri, note, refresh])

  const handleDelete = useCallback((id: string) => {
    Alert.alert('确认删除', '确定删除这条音乐记忆吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deletePhotoLink(id)
          toast('已删除')
          void refresh()
        },
      },
    ])
  }, [refresh])

  const handleLoadMemoryYear = useCallback(async (years: number) => {
    setSelectedYear(years)
    const mem = await getMemoriesOnThisDay(years)
    setMemories(mem)
  }, [])

  return (
    <Section title="音乐相册">
      <ScrollView style={styles.container} nestedScrollEnabled>
        {/* 视图切换 */}
        <View style={styles.tabBar}>
          {([
            { id: 'memories', name: '那年今日' },
            { id: 'timeline', name: '时间线' },
            { id: 'all', name: '全部' },
          ] as const).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setView(tab.id)}
              style={[
                styles.tab,
                { backgroundColor: view === tab.id ? theme['c-primary'] : theme['c-primary-light-100-alpha-800'] },
              ]}
            >
              <Text size={12} color={view === tab.id ? '#fff' : theme['c-font']}>{tab.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 添加按钮 */}
        <TouchableOpacity
          onPress={() => setShowAdd(true)}
          style={[styles.addBtn, { backgroundColor: theme['c-primary'] }]}
        >
          <Icon name="add-music" color="#fff" size={16} />
          <Text color="#fff" size={13} style={{ marginLeft: 8 }}>添加音乐记忆</Text>
        </TouchableOpacity>

        {/* 内容区 */}
        {view === 'memories' && (
          <View>
            {memoryYears.length > 0 && (
              <View style={styles.yearBar}>
                {memoryYears.map((y) => (
                  <TouchableOpacity
                    key={y}
                    onPress={() => handleLoadMemoryYear(y)}
                    style={[
                      styles.yearBtn,
                      { backgroundColor: selectedYear === y ? theme['c-primary'] : theme['c-primary-light-100-alpha-800'] },
                    ]}
                  >
                    <Text size={11} color={selectedYear === y ? '#fff' : theme['c-font']}>{y}年前</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {memories.length === 0 ? (
              <Text size={13} color={theme['c-font-label']} style={styles.emptyHint}>
                还没有那年今日的音乐记忆
              </Text>
            ) : (
              memories.map((link) => <PhotoLinkCard key={link.id} link={link} theme={theme} onDelete={handleDelete} />)
            )}
          </View>
        )}

        {view === 'timeline' && (
          <View>
            {timeline.length === 0 ? (
              <Text size={13} color={theme['c-font-label']} style={styles.emptyHint}>
                还没有音乐记忆
              </Text>
            ) : (
              timeline.map((group) => (
                <View key={group.month} style={styles.timelineGroup}>
                  <Text size={13} color={theme['c-primary']} fontWeight="bold" style={styles.timelineMonth}>
                    {group.month}
                  </Text>
                  {group.links.map((link) => (
                    <PhotoLinkCard key={link.id} link={link} theme={theme} onDelete={handleDelete} />
                  ))}
                </View>
              ))
            )}
          </View>
        )}

        {view === 'all' && (
          <View>
            {links.length === 0 ? (
              <Text size={13} color={theme['c-font-label']} style={styles.emptyHint}>
                还没有音乐记忆
              </Text>
            ) : (
              links.map((link) => <PhotoLinkCard key={link.id} link={link} theme={theme} onDelete={handleDelete} />)
            )}
          </View>
        )}
      </ScrollView>

      {/* 添加弹窗 */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme['c-content-background'] }]}>
            <View style={styles.modalHeader}>
              <Text size={16} color={theme['c-font']} fontWeight="bold">添加音乐记忆</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Icon name="close" size={20} color={theme['c-font-label']} />
              </TouchableOpacity>
            </View>
            <Text size={13} color={theme['c-font-label']} style={styles.modalHint}>
              将关联当前正在播放的歌曲
            </Text>
            <TextInput
              style={[styles.input, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
              value={photoUri}
              onChangeText={setPhotoUri}
              placeholder="照片路径（如 file:///path/photo.jpg）"
              placeholderTextColor={theme['c-font-label']}
            />
            <TextInput
              style={[styles.input, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
              value={note}
              onChangeText={setNote}
              placeholder="备注（可选）"
              placeholderTextColor={theme['c-font-label']}
              multiline
            />
            <TouchableOpacity
              onPress={handleAdd}
              style={[styles.saveBtn, { backgroundColor: theme['c-primary'] }]}
            >
              <Text color="#fff" size={14}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Section>
  )
})

const PhotoLinkCard = ({ link, theme, onDelete }: { link: PhotoLink; theme: any; onDelete: (id: string) => void }) => (
  <View style={[styles.card, { borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-200'] }]}>
    {link.photoUri ? (
      <Image source={{ uri: link.photoUri }} style={styles.cardImage} resizeMode="cover" />
    ) : (
      <View style={[styles.cardImagePlaceholder, { backgroundColor: theme['c-primary-light-400-alpha-600'] }]}>
        <Icon name="logo" size={24} color={theme['c-font-label']} />
      </View>
    )}
    <View style={styles.cardContent}>
      <Text size={13} color={theme['c-font']} fontWeight="500">{link.musicName}</Text>
      <Text size={11} color={theme['c-font-label']}>{link.singer}</Text>
      {link.note ? <Text size={11} color={theme['c-font-label']} style={styles.cardNote}>{link.note}</Text> : null}
      <Text size={10} color={theme['c-font-label']}>
        {new Date(link.takenAt ?? link.createdAt).toLocaleDateString('zh-CN')}
      </Text>
    </View>
    <TouchableOpacity onPress={() => onDelete(link.id)} style={styles.deleteBtn}>
      <Icon name="close" size={16} color={theme['c-liked']} />
    </TouchableOpacity>
  </View>
)

const styles = createStyle({
  container: { paddingLeft: 25, paddingRight: 15 },
  tabBar: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  yearBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  yearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  emptyHint: {
    textAlign: 'center',
    paddingVertical: 40,
  },
  card: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  cardImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 10,
  },
  cardNote: {
    marginTop: 4,
    fontStyle: 'italic',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineGroup: {
    marginBottom: 12,
  },
  timelineMonth: {
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
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
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalHint: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 10,
  },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
})
