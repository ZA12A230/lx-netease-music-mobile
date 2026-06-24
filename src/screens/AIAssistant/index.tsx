// @ts-nocheck
import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { View, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert, ScrollView, TouchableOpacity } from 'react-native'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { chat, getActiveServiceId, setActiveService, getPresetServices, getUserApiKey, setUserApiKey, summarizeLyrics, initAiService } from '@/core/ai'
import { checkQuota, authorize, getRemainingQuota, isAuthorized } from '@/core/ai/quota'
import { getUserXunfeiConfig, setUserXunfeiConfig, XUNFEI_MODELS } from '@/core/ai/config'
import type { ChatMessage as AIChatMessage } from '@/core/ai/providers/xunfei'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT } from '@/config/constant'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

const MusicAssistant = () => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '🎵 你好！我是LX-N Music的音乐助手\n\n我可以帮你：\n• 搜索和播放歌曲\n• 下载喜欢的音乐\n• 查询歌词并总结\n• 推荐相似歌曲\n\n有什么可以帮你的吗？',
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
    void initAiService()
    refreshQuota()
  }, [refreshQuota])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

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
        <View style={styles.msgAvatarWrap}>
          {isUser ? (
            <View style={[styles.msgAvatar, { backgroundColor: theme['c-primary-light-400-alpha-600'] }]}>
              <Text size={14} color="#fff">👤</Text>
            </View>
          ) : (
            <View style={[styles.msgAvatar, { backgroundColor: theme['c-primary'] }]}>
              <Text size={14} color="#fff">🎵</Text>
            </View>
          )}
        </View>
        <View style={[
          styles.msgBubble,
          isUser
            ? { backgroundColor: theme['c-primary'], borderColor: theme['c-primary'] }
            : { backgroundColor: theme['c-primary-light-100-alpha-80'], borderColor: theme['c-primary-light-400-alpha-40'] },
        ]}>
          {item.loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme['c-primary-font']} size="small" />
              <Text size={14} color={theme['c-font-label']} style={{ marginLeft: 8 }}>思考中...</Text>
            </View>
          ) : (
            <Text style={styles.msgText} color={isUser ? '#fff' : theme['c-font']}>
              {item.content}
            </Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme['c-background'] }]}>
      {/* 顶部装饰条 */}
      <View style={[styles.topGradient, { backgroundColor: theme['c-primary'] }]} />

      {/* 顶部栏 */}
      <View style={[
        styles.header,
        {
          backgroundColor: theme['c-content-background'],
          paddingTop: statusBarHeight,
          height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
        },
      ]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoIcon, { backgroundColor: theme['c-primary'] }]}>
            <Icon name="message-circle" color="#fff" size={20} />
          </View>
          <Text style={styles.headerTitle} size={18} color={theme['c-font']}>
            {t('nav_music_assistant')}
          </Text>
        </View>
        <Button onPress={() => setShowSettings(true)} style={[styles.headerBtn, { backgroundColor: theme['c-primary-light-100-alpha-40'] }]}>
          <Icon name="setting" color={theme['c-font']} size={22} />
        </Button>
      </View>

      {/* 用量显示 */}
      <View style={[styles.quotaBar, { backgroundColor: theme['c-primary-light-100-alpha-20'] }]}>
        <Text size={12} color={theme['c-font-label']}>
          {authorized ? '✓ 已授权无限使用' : remaining >= 0 ? `免费剩余：${remaining} 次` : ''}
          {'  |  '}{getPresetServices().find((s) => s.id === getActiveServiceId())?.name || '未知'}
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
        <View style={[styles.inputBar, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-light-100-alpha-40'] }]}>
          <View style={[styles.inputWrap, { backgroundColor: theme['c-primary-light-100-alpha-40'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
            <TextInput
              style={[styles.input, { color: theme['c-font'] }]}
              value={input}
              onChangeText={setInput}
              placeholder="输入消息..."
              placeholderTextColor={theme['c-font-label']}
              multiline
              maxLength={500}
              editable={!sending}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
          </View>
          <TouchableOpacity
            onPress={handleSend}
            disabled={sending || !input.trim()}
            style={[styles.sendBtn, { 
              backgroundColor: sending || !input.trim() ? theme['c-primary-light-100-alpha-40'] : theme['c-primary'],
            }]}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Icon name="send" color="#fff" size={20} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 设置弹窗 */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <SettingsModal onClose={() => setShowSettings(false)} theme={theme} onRefresh={refreshQuota} />
      </Modal>

      {/* 密码授权弹窗 */}
      <Modal visible={showAuth} transparent animationType="fade" onRequestClose={() => setShowAuth(false)}>
        <View style={styles.authOverlay}>
          <View style={[styles.authBox, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
            <Text size={20} color={theme['c-font']} style={styles.authTitle} fontWeight="bold">
              🔐 管理员授权
            </Text>
            <Text size={14} color={theme['c-font-label']} style={styles.authDesc}>
              免费对话次数已用完，请输入管理员密码继续使用
            </Text>
            <TextInput
              style={[styles.authInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-600'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
              value={authPwd}
              onChangeText={setAuthPwd}
              placeholder="请输入管理员密码"
              placeholderTextColor={theme['c-font-label']}
              secureTextEntry
              onSubmitEditing={handleAuth}
            />
            <View style={styles.authBtns}>
              <Button onPress={() => setShowAuth(false)} style={[styles.authBtn, { backgroundColor: theme['c-primary-light-100-alpha-40'] }]}>
                <Text color={theme['c-font']}>取消</Text>
              </Button>
              <Button onPress={handleAuth} style={[styles.authBtn, { backgroundColor: theme['c-primary'] }]}>
                <Text color="#fff">确认</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const SettingsModal = memo(({ onClose, theme, onRefresh }: { onClose: () => void; theme: any; onRefresh: () => void }) => {
  const [services] = useState(getPresetServices())
  const [activeId, setActiveId] = useState(getActiveServiceId())
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [showAuth, setShowAuth] = useState(false)
  const [authPwd, setAuthPwd] = useState('')
  const [xunfeiConfig, setXunfeiConfig] = useState(getUserXunfeiConfig())
  const [showXunfeiDetail, setShowXunfeiDetail] = useState(false)
  const [selectedModel, setSelectedModel] = useState(xunfeiConfig.model || '4.0Ultra')

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

  const handleSaveXunfeiConfig = () => {
    setUserXunfeiConfig({ ...xunfeiConfig, model: selectedModel })
    Alert.alert('保存成功', '科大讯飞自定义配置已保存')
    setShowXunfeiDetail(false)
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
      <View style={[styles.settingsBox, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
        <View style={styles.settingsHeader}>
          <Text size={20} color={theme['c-font']} fontWeight="bold">⚙️ 音乐助手设置</Text>
          <Button onPress={onClose} style={styles.headerBtn}>
            <Text color={theme['c-font-label']} size={24}>✕</Text>
          </Button>
        </View>
        <ScrollView style={styles.settingsList}>
          {services.map((s) => (
            <View key={s.id} style={[styles.serviceItem, { 
              borderColor: activeId === s.id ? theme['c-primary'] : 'transparent',
              backgroundColor: theme['c-primary-light-100-alpha-20'],
            }]}>
              <View style={styles.serviceHeader}>
                <Text size={15} color={theme['c-font']} fontWeight="500">{s.name}</Text>
                {s.builtin ? (
                  <View style={[styles.badge, { backgroundColor: theme['c-primary-light-400-alpha-40'] }]}>
                    <Text size={10} color={theme['c-primary-font']}>内置可用</Text>
                  </View>
                ) : null}
              </View>
              {s.id === 'xunfei_custom' ? (
                <View style={styles.xunfeiCustomSection}>
                  <TouchableOpacity 
                    onPress={() => setShowXunfeiDetail(true)}
                    style={[styles.detailBtn, { backgroundColor: theme['c-primary-light-100-alpha-40'] }]}
                  >
                    <Text size={13} color={theme['c-font-label']}>
                      {xunfeiConfig.appid ? '已配置 - 点击修改' : '点击配置应用信息'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : !s.builtin ? (
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-40'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
                  value={apiKeys[s.id] || ''}
                  onChangeText={(v) => setApiKeys((prev) => ({ ...prev, [s.id]: v }))}
                  placeholder={`输入 ${s.name} API Key`}
                  placeholderTextColor={theme['c-font-label']}
                  secureTextEntry
                  onBlur={() => handleSaveKey(s.id, apiKeys[s.id] || '')}
                />
              ) : null}
              <Button
                onPress={() => handleSelect(s.id)}
                disabled={activeId === s.id}
                style={[styles.selectBtn, { 
                  backgroundColor: activeId === s.id ? theme['c-primary'] : theme['c-primary-light-100-alpha-40'],
                }]}
              >
                <Text color={activeId === s.id ? '#fff' : theme['c-font']} size={13}>
                  {activeId === s.id ? '✓ 当前使用' : '切换到此服务'}
                </Text>
              </Button>
            </View>
          ))}
          <View style={styles.authSection}>
            <Button onPress={() => setShowAuth(true)} style={[styles.authBtn, { backgroundColor: theme['c-primary'] }]}>
              <Text color="#fff" size={14}>🔐 输入管理员密码授权（无限使用）</Text>
            </Button>
          </View>
        </ScrollView>

        {/* 科大讯飞自定义配置弹窗 */}
        <Modal visible={showXunfeiDetail} transparent animationType="slide" onRequestClose={() => setShowXunfeiDetail(false)}>
          <View style={styles.settingsOverlay}>
            <View style={[styles.settingsBox, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
              <View style={styles.settingsHeader}>
                <Text size={18} color={theme['c-font']} fontWeight="bold">📝 科大讯飞配置</Text>
                <Button onPress={() => setShowXunfeiDetail(false)} style={styles.headerBtn}>
                  <Text color={theme['c-font-label']} size={24}>✕</Text>
                </Button>
              </View>
              <ScrollView style={styles.settingsList}>
                <Text size={12} color={theme['c-font-label']} style={styles.descText}>
                  请在 https://console.xfyun.cn/app/myapp 获取以下信息
                </Text>
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-40'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
                  value={xunfeiConfig.appid}
                  onChangeText={(v) => setXunfeiConfig((prev) => ({ ...prev, appid: v }))}
                  placeholder="APPID"
                  placeholderTextColor={theme['c-font-label']}
                />
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-40'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
                  value={xunfeiConfig.apiKey}
                  onChangeText={(v) => setXunfeiConfig((prev) => ({ ...prev, apiKey: v }))}
                  placeholder="API Key"
                  placeholderTextColor={theme['c-font-label']}
                  secureTextEntry
                />
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-40'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
                  value={xunfeiConfig.apiSecret}
                  onChangeText={(v) => setXunfeiConfig((prev) => ({ ...prev, apiSecret: v }))}
                  placeholder="API Secret"
                  placeholderTextColor={theme['c-font-label']}
                  secureTextEntry
                />
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-40'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
                  value={xunfeiConfig.wssUrl || 'wss://spark-api.xf-yun.com/v4.0/chat'}
                  onChangeText={(v) => setXunfeiConfig((prev) => ({ ...prev, wssUrl: v }))}
                  placeholder="WebSocket URL"
                  placeholderTextColor={theme['c-font-label']}
                />
                <View style={styles.modelSelectSection}>
                  <Text size={13} color={theme['c-font']} style={{ marginBottom: 8 }}>选择模型：</Text>
                  <View style={styles.modelButtons}>
                    {XUNFEI_MODELS.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        onPress={() => setSelectedModel(m.id)}
                        style={[styles.modelBtn, { 
                          backgroundColor: selectedModel === m.id ? theme['c-primary'] : theme['c-primary-light-100-alpha-40'],
                        }]}
                      >
                        <Text size={12} color={selectedModel === m.id ? '#fff' : theme['c-font']}>
                          {m.name}
                        </Text>
                        <Text size={10} color={selectedModel === m.id ? 'rgba(255,255,255,0.7)' : theme['c-font-label']}>
                          ({m.desc})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <Button onPress={handleSaveXunfeiConfig} style={[styles.saveBtn, { backgroundColor: theme['c-primary'] }]}>
                  <Text color="#fff" size={14}>保存配置</Text>
                </Button>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 管理员授权弹窗 */}
        <Modal visible={showAuth} transparent animationType="fade" onRequestClose={() => setShowAuth(false)}>
          <View style={styles.authOverlay}>
            <View style={[styles.authBox, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
              <Text size={18} color={theme['c-font']} style={styles.authTitle} fontWeight="bold">🔐 管理员授权</Text>
              <Text size={14} color={theme['c-font-label']} style={styles.authDesc}>
                输入管理员密码解锁无限对话次数
              </Text>
              <TextInput
                style={[styles.authInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-600'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
                value={authPwd}
                onChangeText={setAuthPwd}
                placeholder="请输入管理员密码"
                placeholderTextColor={theme['c-font-label']}
                secureTextEntry
                onSubmitEditing={handleAuth}
              />
              <View style={styles.authBtns}>
                <Button onPress={() => setShowAuth(false)} style={[styles.authBtn, { backgroundColor: theme['c-primary-light-100-alpha-40'] }]}>
                  <Text color={theme['c-font']}>取消</Text>
                </Button>
                <Button onPress={handleAuth} style={[styles.authBtn, { backgroundColor: theme['c-primary'] }]}>
                  <Text color="#fff">确认</Text>
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
  topGradient: { 
    height: 8, 
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerBtn: { 
    padding: 8, 
    borderRadius: 10,
  },
  headerTitle: { fontWeight: 'bold' },
  quotaBar: { 
    paddingVertical: 8, 
    paddingHorizontal: 15, 
    alignItems: 'center',
  },
  msgList: { 
    padding: 15, 
    paddingBottom: 100,
    paddingTop: 20,
  },
  msgRow: { 
    marginVertical: 12, 
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  msgRowUser: { justifyContent: 'flex-end', flexDirection: 'row-reverse' },
  msgRowAI: { justifyContent: 'flex-start' },
  msgAvatarWrap: {
    width: 40,
    height: 40,
    flexShrink: 0,
  },
  msgAvatar: {
    width: 36,
    height: 36,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginLeft: 10,
  },
  msgBubble: {
    maxWidth: '75%',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  msgText: { 
    fontSize: 15, 
    lineHeight: 22,
    whiteSpace: 'pre-wrap',
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    paddingBottom: 40,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 25,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    width: 45,
    height: 45,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  authOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  authBox: {
    width: '100%',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
  },
  authTitle: { textAlign: 'center', marginBottom: 15 },
  authDesc: { textAlign: 'center', marginBottom: 20 },
  authInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  authBtns: { flexDirection: 'row', justifyContent: 'space-around' },
  authBtn: { 
    flex: 1, 
    marginHorizontal: 10, 
    paddingVertical: 14, 
    borderRadius: 14, 
    alignItems: 'center',
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  settingsBox: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsList: { maxHeight: 500 },
  serviceItem: {
    padding: 15,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 2,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  xunfeiCustomSection: {
    marginBottom: 12,
  },
  detailBtn: {
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  keyInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  selectBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  authSection: { 
    marginTop: 10, 
    marginBottom: 20,
  },
  descText: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    textAlign: 'center',
  },
  modelSelectSection: {
    marginBottom: 12,
  },
  modelButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
})

export default MusicAssistant
