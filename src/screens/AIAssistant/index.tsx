import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { View, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert, ScrollView } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Icon from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { chat, getActiveServiceId, setActiveService, getPresetServices, getUserApiKey, setUserApiKey, summarizeLyrics } from '@/core/ai'
import { checkQuota, authorize, getRemainingQuota, isAuthorized } from '@/core/ai/quota'
import type { ChatMessage as AIChatMessage } from '@/core/ai/providers/xunfei'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

const AIAssistant = ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是LX-N Music的AI助手🎵\n你可以对我说：\n• "播放周杰伦的晴天"\n• "下载夜曲"\n• "搜索张学友的歌"\n• "这首歌的歌词是什么"\n• "总结一下歌词"\n\n有什么可以帮你的吗？',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authPwd, setAuthPwd] = useState('')
  const [remaining, setRemaining] = useState<number>(-1)
  const [authorized, setAuthorized] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  const refreshQuota = useCallback(async () => {
    const r = await getRemainingQuota()
    const a = await isAuthorized()
    setRemaining(r)
    setAuthorized(a)
  }, [])

  useEffect(() => {
    refreshQuota()
  }, [refreshQuota])

  const handleClose = () => {
    Navigation.dismissModal(componentId)
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    // 检查用量
    const quota = await checkQuota()
    if (!quota.allowed) {
      setShowAuth(true)
      return
    }

    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: text }
    const assistantMsg: Message = { id: `a_${Date.now()}`, role: 'assistant', content: '', loading: true }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setSending(true)

    // 构造历史消息
    const history: AIChatMessage[] = messages
      .filter((m) => !m.loading && m.content)
      .map((m) => ({ role: m.role, content: m.content }))

    let chunkBuffer = ''
    try {
      const result = await chat(
        text,
        history,
        (chunk) => {
          chunkBuffer += chunk
          setMessages((prev) =>
            prev.map((m) => m.id === assistantMsg.id ? { ...m, content: chunkBuffer, loading: false } : m)
          )
        },
        (toolName, toolResult) => {
          // 工具执行反馈
          setMessages((prev) => [
            ...prev,
            {
              id: `t_${Date.now()}_${Math.random()}`,
              role: 'assistant',
              content: `🔧 执行操作：${toolName}\n${toolResult}`,
            },
          ])
        }
      )

      // 最终回复
      if (result && !chunkBuffer) {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, content: result, loading: false } : m)
        )
      } else {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, loading: false } : m)
        )
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsg.id ? { ...m, content: `❌ ${err.message}`, loading: false } : m)
      )
      if (err.message?.includes('管理员密码')) {
        setShowAuth(true)
      }
    } finally {
      setSending(false)
      refreshQuota()
    }
  }

  const handleAuth = async () => {
    const ok = await authorize(authPwd)
    if (ok) {
      setAuthorized(true)
      setShowAuth(false)
      setAuthPwd('')
      Alert.alert('授权成功', '已解锁无限对话次数')
      refreshQuota()
    } else {
      Alert.alert('密码错误', '请输入正确的管理员密码')
    }
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        <View style={[
          styles.msgBubble,
          isUser
            ? { backgroundColor: theme['c-primary-light-400-alpha-600'], borderColor: 'rgba(255,255,255,0.35)' }
            : { backgroundColor: theme['c-primary-light-100-alpha-400'], borderColor: 'rgba(255,255,255,0.2)' },
        ]}>
          {item.loading ? (
            <ActivityIndicator color={theme['c-primary-font']} size="small" />
          ) : (
            <Text style={styles.msgText} color={theme['c-font']}>
              {item.content}
            </Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
      {/* 顶部栏 */}
      <View style={[styles.header, { backgroundColor: theme['c-primary-light-100-alpha-400'], borderColor: 'rgba(255,255,255,0.2)' }]}>
        <Button onPress={handleClose} style={styles.headerBtn}>
          <Icon name="back" color={theme['c-font']} size={18} />
        </Button>
        <Text style={styles.headerTitle} size={18} color={theme['c-font']}>
          AI 助手
        </Text>
        <Button onPress={() => setShowSettings(true)} style={styles.headerBtn}>
          <Icon name="setting" color={theme['c-font']} size={18} />
        </Button>
      </View>

      {/* 用量显示 */}
      <View style={styles.quotaBar}>
        <Text size={12} color={theme['c-font-label']}>
          {authorized ? '✓ 已授权无限使用' : remaining >= 0 ? `免费剩余：${remaining} 次` : ''}
          {'  |  当前服务：'}{getPresetServices().find((s) => s.id === getActiveServiceId())?.name || '未知'}
        </Text>
      </View>

      {/* 消息列表 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.msgList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* 输入区 */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputBar, { backgroundColor: theme['c-primary-light-100-alpha-400'], borderColor: 'rgba(255,255,255,0.2)' }]}>
          <TextInput
            style={[styles.input, { color: theme['c-font'] }]}
            value={input}
            onChangeText={setInput}
            placeholder="对我说点什么..."
            placeholderTextColor={theme['c-font-label']}
            multiline
            maxLength={500}
            editable={!sending}
          />
          <Button
            onPress={handleSend}
            disabled={sending || !input.trim()}
            style={[styles.sendBtn, { backgroundColor: theme['c-button-background'] }]}
          >
            <Text color={theme['c-button-font']} size={15}>
              {sending ? '...' : '发送'}
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>

      {/* 设置弹窗 */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <SettingsModal onClose={() => setShowSettings(false)} theme={theme} onRefresh={refreshQuota} />
      </Modal>

      {/* 密码授权弹窗 */}
      <Modal visible={showAuth} transparent animationType="fade" onRequestClose={() => setShowAuth(false)}>
        <View style={styles.authOverlay}>
          <View style={[styles.authBox, { backgroundColor: theme['c-content-background'] }]}>
            <Text size={18} color={theme['c-font']} style={styles.authTitle}>
              管理员授权
            </Text>
            <Text size={14} color={theme['c-font-label']} style={styles.authDesc}>
              免费对话次数已用完，请输入管理员密码继续使用
            </Text>
            <TextInput
              style={[styles.authInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-600'] }]}
              value={authPwd}
              onChangeText={setAuthPwd}
              placeholder="请输入管理员密码"
              placeholderTextColor={theme['c-font-label']}
              secureTextEntry
              onSubmitEditing={handleAuth}
            />
            <View style={styles.authBtns}>
              <Button onPress={() => setShowAuth(false)} style={[styles.authBtn, { backgroundColor: theme['c-button-background'] }]}>
                <Text color={theme['c-button-font']}>取消</Text>
              </Button>
              <Button onPress={handleAuth} style={[styles.authBtn, { backgroundColor: theme['c-button-background'] }]}>
                <Text color={theme['c-button-font']}>确认</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ============ 设置弹窗 ============
const SettingsModal = memo(({ onClose, theme, onRefresh }: { onClose: () => void; theme: any; onRefresh: () => void }) => {
  const [services] = useState(getPresetServices())
  const [activeId, setActiveId] = useState(getActiveServiceId())
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [showAuth, setShowAuth] = useState(false)
  const [authPwd, setAuthPwd] = useState('')

  useEffect(() => {
    services.forEach((s) => {
      const key = getUserApiKey(s.id)
      if (key) setApiKeys((prev) => ({ ...prev, [s.id]: key }))
    })
  }, [services])

  const handleSelect = async (id: string) => {
    await setActiveService(id)
    setActiveId(id)
  }

  const handleSaveKey = async (id: string, key: string) => {
    await setUserApiKey(id, key)
    setApiKeys((prev) => ({ ...prev, [id]: key }))
  }

  const handleAuth = async () => {
    const ok = await authorize(authPwd)
    if (ok) {
      Alert.alert('授权成功', '已解锁无限对话次数')
      setShowAuth(false)
      setAuthPwd('')
      onRefresh()
    } else {
      Alert.alert('密码错误', '请输入正确的管理员密码')
    }
  }

  return (
    <View style={styles.settingsOverlay}>
      <View style={[styles.settingsBox, { backgroundColor: theme['c-content-background'] }]}>
        <View style={styles.settingsHeader}>
          <Text size={18} color={theme['c-font']}>AI 服务设置</Text>
          <Button onPress={onClose} style={styles.headerBtn}>
            <Text color={theme['c-font']}>✕</Text>
          </Button>
        </View>
        <ScrollView style={styles.settingsList}>
          {services.map((s) => (
            <View key={s.id} style={[styles.serviceItem, activeId === s.id ? { borderColor: theme['c-primary'] } : { borderColor: 'transparent' }]}>
              <View style={styles.serviceHeader}>
                <Text size={15} color={theme['c-font']}>{s.name}</Text>
                {s.builtin ? (
                  <Text size={12} color={theme['c-primary-font']}>内置可用</Text>
                ) : null}
              </View>
              {s.builtin ? null : (
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-600'] }]}
                  value={apiKeys[s.id] || ''}
                  onChangeText={(v) => setApiKeys((prev) => ({ ...prev, [s.id]: v }))}
                  placeholder="输入 API Key"
                  placeholderTextColor={theme['c-font-label']}
                  secureTextEntry
                  onBlur={() => handleSaveKey(s.id, apiKeys[s.id] || '')}
                />
              )}
              <Button
                onPress={() => handleSelect(s.id)}
                disabled={activeId === s.id}
                style={[styles.selectBtn, { backgroundColor: theme['c-button-background'] }]}
              >
                <Text color={theme['c-button-font']} size={13}>
                  {activeId === s.id ? '✓ 当前使用' : '切换到此服务'}
                </Text>
              </Button>
            </View>
          ))}
          <View style={styles.authSection}>
            <Button onPress={() => setShowAuth(true)} style={[styles.selectBtn, { backgroundColor: theme['c-button-background'] }]}>
              <Text color={theme['c-button-font']} size={13}>输入管理员密码授权</Text>
            </Button>
          </View>
        </ScrollView>

        <Modal visible={showAuth} transparent animationType="fade" onRequestClose={() => setShowAuth(false)}>
          <View style={styles.authOverlay}>
            <View style={[styles.authBox, { backgroundColor: theme['c-content-background'] }]}>
              <Text size={18} color={theme['c-font']} style={styles.authTitle}>管理员授权</Text>
              <TextInput
                style={[styles.authInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-600'] }]}
                value={authPwd}
                onChangeText={setAuthPwd}
                placeholder="请输入管理员密码"
                placeholderTextColor={theme['c-font-label']}
                secureTextEntry
                onSubmitEditing={handleAuth}
              />
              <View style={styles.authBtns}>
                <Button onPress={() => setShowAuth(false)} style={[styles.authBtn, { backgroundColor: theme['c-button-background'] }]}>
                  <Text color={theme['c-button-font']}>取消</Text>
                </Button>
                <Button onPress={handleAuth} style={[styles.authBtn, { backgroundColor: theme['c-button-background'] }]}>
                  <Text color={theme['c-button-font']}>确认</Text>
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  )
})

const styles = createStyle({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 8, borderRadius: 18 },
  headerTitle: { fontWeight: 'bold' },
  quotaBar: { paddingVertical: 6, paddingHorizontal: 15, alignItems: 'center' },
  msgList: { padding: 15, paddingBottom: 80 },
  msgRow: { marginVertical: 6, flexDirection: 'row' },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAI: { justifyContent: 'flex-start' },
  msgBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    paddingBottom: 34,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: 8,
  },
  sendBtn: {
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  authOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  authBox: {
    width: '100%',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  authTitle: { textAlign: 'center', marginBottom: 15, fontWeight: 'bold' },
  authDesc: { textAlign: 'center', marginBottom: 15 },
  authInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  authBtns: { flexDirection: 'row', justifyContent: 'space-around' },
  authBtn: { flex: 1, marginHorizontal: 8, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  settingsBox: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingsList: { maxHeight: 400 },
  serviceItem: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  keyInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  selectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  authSection: { marginTop: 10, marginBottom: 20 },
})

export default AIAssistant
