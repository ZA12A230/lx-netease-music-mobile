// @ts-nocheck
import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { View, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { chat, getActiveServiceId, setActiveService, getPresetServices, getUserApiKey, setUserApiKey, summarizeLyrics, initAiService, getAllServices, getCustomServices, addCustomService, deleteCustomService } from '@/core/ai'
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
      content: '你好！我是 LX-N Music 的音乐助手\n\n我可以帮你：\n• 搜索和播放歌曲\n• 下载喜欢的音乐\n• 查询歌词并总结\n• 推荐相似歌曲\n\n有什么可以帮你的吗？',
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
              content: `执行操作：${toolName}\n${toolResult}`,
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
        prev.map((m) => m.id === assistantMsg.id ? { ...m, content: `${err.message}`, loading: false } : m)
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
              <Text size={13} color={theme['c-primary-font']} fontWeight="bold">我</Text>
            </View>
          ) : (
            <View style={[styles.msgAvatar, { backgroundColor: theme['c-primary'] }]}>
              <Icon name="music_time" size={16} color={theme['c-primary-light-1000']} />
            </View>
          )}
        </View>
        <View style={[
          styles.msgBubble,
          isUser
            ? { backgroundColor: theme['c-primary'], borderColor: theme['c-primary'] }
            : { backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] },
        ]}>
          {item.loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme['c-primary']} size="small" />
              <Text size={13} color={theme['c-font-label']} style={{ marginLeft: 8 }}>思考中...</Text>
            </View>
          ) : (
            <Text style={styles.msgText} color={isUser ? theme['c-primary-light-1000'] : theme['c-font']}>
              {item.content}
            </Text>
          )}
        </View>
      </View>
    )
  }

  const activeServiceName = getPresetServices().find((s) => s.id === getActiveServiceId())?.name || '未选择'

  return (
    <View style={[styles.container, { backgroundColor: theme['c-main-background'] }]}>

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
            <Icon name="music_time" color={theme['c-primary-light-1000']} size={18} />
          </View>
          <View>
            <Text style={styles.headerTitle} size={15} color={theme['c-font']}>
              {t('nav_music_assistant')}
            </Text>
            <Text size={11} color={theme['c-font-label']}>
              {activeServiceName}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={[styles.headerBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'] }]}
          activeOpacity={0.7}
        >
          <Icon name="setting" color={theme['c-font']} size={18} />
        </TouchableOpacity>
      </View>

      {/* 用量提示条 */}
      <View style={[styles.quotaBar, { backgroundColor: theme['c-primary-light-100-alpha-900'] }]}>
        <View style={[styles.quotaDot, { backgroundColor: authorized ? theme['c-primary'] : theme['c-font-label'] }]} />
        <Text size={11} color={theme['c-font-label']}>
          {authorized ? '已授权 · 无限使用' : remaining >= 0 ? `免费剩余 ${remaining} 次` : '加载中...'}
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
        <View style={[styles.inputBar, { backgroundColor: theme['c-content-background'], borderTopColor: theme['c-primary-light-400-alpha-800'] }]}>
          <View style={[styles.inputWrap, { backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}>
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
            activeOpacity={0.7}
            style={[
              styles.sendBtn,
              {
                backgroundColor: sending || !input.trim()
                  ? theme['c-primary-light-400-alpha-600']
                  : theme['c-primary'],
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator color={theme['c-primary-light-1000']} size="small" />
            ) : (
              <Icon name="play" color={theme['c-primary-light-1000']} size={16} />
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
          <View style={[styles.authBox, { backgroundColor: theme['c-content-background'] }]}>
            <View style={styles.authIconWrap}>
              <View style={[styles.authIconCircle, { backgroundColor: theme['c-primary'] }]}>
                <Icon name="setting" color={theme['c-primary-light-1000']} size={20} />
              </View>
            </View>
            <Text size={16} color={theme['c-font']} fontWeight="bold" style={styles.authTitle}>
              管理员授权
            </Text>
            <Text size={12} color={theme['c-font-label']} style={styles.authDesc}>
              免费对话次数已用完，请输入管理员密码继续使用
            </Text>
            <TextInput
              style={[styles.authInput, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
              value={authPwd}
              onChangeText={setAuthPwd}
              placeholder="请输入管理员密码"
              placeholderTextColor={theme['c-font-label']}
              secureTextEntry
              onSubmitEditing={handleAuth}
            />
            <View style={styles.authBtns}>
              <TouchableOpacity
                onPress={() => setShowAuth(false)}
                style={[styles.authBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'] }]}
                activeOpacity={0.7}
              >
                <Text color={theme['c-font']} size={14}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAuth}
                style={[styles.authBtn, { backgroundColor: theme['c-primary'] }]}
                activeOpacity={0.7}
              >
                <Text color={theme['c-primary-light-1000']} size={14}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const SettingsModal = memo(({ onClose, theme, onRefresh }: { onClose: () => void; theme: any; onRefresh: () => void }) => {
  const [allServices, setAllServices] = useState(getAllServices())
  const [activeId, setActiveId] = useState(getActiveServiceId())
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [showAuth, setShowAuth] = useState(false)
  const [authPwd, setAuthPwd] = useState('')
  const [xunfeiConfig, setXunfeiConfig] = useState(getUserXunfeiConfig())
  const [showXunfeiDetail, setShowXunfeiDetail] = useState(false)
  const [selectedModel, setSelectedModel] = useState(xunfeiConfig.model || '4.0Ultra')
  const [showCustomApi, setShowCustomApi] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [customKey, setCustomKey] = useState('')

  useEffect(() => {
    allServices.forEach((s) => {
      const key = getUserApiKey(s.id)
      if (key) setApiKeys((prev) => ({ ...prev, [s.id]: key }))
    })
  }, [allServices])

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

  /** 添加自定义API服务 */
  const handleAddCustomService = async () => {
    if (!customName.trim() || !customUrl.trim() || !customModel.trim()) {
      Alert.alert('提示', '请填写名称、API地址和模型名称')
      return
    }
    const id = await addCustomService({
      name: customName.trim(),
      apiUrl: customUrl.trim(),
      model: customModel.trim(),
      apiKey: customKey.trim(),
    })
    setAllServices(getAllServices())
    setCustomName('')
    setCustomUrl('')
    setCustomModel('')
    setCustomKey('')
    setShowCustomApi(false)
    Alert.alert('添加成功', '已添加自定义API服务，可在列表中选择使用')
  }

  /** 删除自定义服务 */
  const handleDeleteCustom = async (id: string) => {
    Alert.alert('确认删除', '确定要删除这个自定义API服务吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteCustomService(id)
          setAllServices(getAllServices())
          setActiveId(getActiveServiceId())
        },
      },
    ])
  }

  return (
    <View style={styles.settingsOverlay}>
      <View style={[styles.settingsBox, { backgroundColor: theme['c-content-background'] }]}>
        <View style={[styles.settingsHeader, { borderBottomColor: theme['c-primary-light-400-alpha-800'] }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="setting" size={18} color={theme['c-primary']} />
            <Text size={16} color={theme['c-font']} fontWeight="bold" style={{ marginLeft: 8 }}>音乐助手设置</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Icon name="close" size={20} color={theme['c-font-label']} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.settingsList} showsVerticalScrollIndicator={false}>
          <Text size={12} color={theme['c-font-label']} style={styles.sectionTitle}>AI 服务列表</Text>
          {allServices.map((s) => (
            <View
              key={s.id}
              style={[
                styles.serviceItem,
                {
                  borderColor: activeId === s.id ? theme['c-primary'] : theme['c-primary-light-400-alpha-800'],
                  backgroundColor: activeId === s.id ? theme['c-primary-light-100-alpha-900'] : theme['c-primary-light-100-alpha-900'],
                },
              ]}
            >
              <View style={styles.serviceHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text size={14} color={theme['c-font']} fontWeight="500">{s.name}</Text>
                  {s.builtin ? (
                    <View style={[styles.badge, { backgroundColor: theme['c-primary-light-400-alpha-700'] }]}>
                      <Text size={10} color={theme['c-primary-font']}>内置</Text>
                    </View>
                  ) : s.id.startsWith('custom_') ? (
                    <View style={[styles.badge, { backgroundColor: theme['c-primary-light-400-alpha-700'] }]}>
                      <Text size={10} color={theme['c-primary-font']}>自定义</Text>
                    </View>
                  ) : null}
                </View>
                {s.id.startsWith('custom_') && (
                  <TouchableOpacity
                    onPress={() => handleDeleteCustom(s.id)}
                    style={styles.iconBtn}
                    activeOpacity={0.7}
                  >
                    <Icon name="close" size={14} color={theme['c-liked']} />
                  </TouchableOpacity>
                )}
              </View>
              {s.id === 'xunfei_custom' ? (
                <View style={styles.xunfeiCustomSection}>
                  <TouchableOpacity
                    onPress={() => setShowXunfeiDetail(true)}
                    style={[styles.detailBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'] }]}
                    activeOpacity={0.7}
                  >
                    <Text size={12} color={theme['c-font-label']}>
                      {xunfeiConfig.appid ? '已配置 - 点击修改' : '点击配置应用信息'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : !s.builtin ? (
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-900'] }]}
                  value={apiKeys[s.id] || ''}
                  onChangeText={(v) => setApiKeys((prev) => ({ ...prev, [s.id]: v }))}
                  placeholder={`输入 ${s.name} API Key`}
                  placeholderTextColor={theme['c-font-label']}
                  secureTextEntry
                  onBlur={() => handleSaveKey(s.id, apiKeys[s.id] || '')}
                />
              ) : null}
              {s.id.startsWith('custom_') && s.apiUrl && (
                <Text size={10} color={theme['c-font-label']} style={styles.apiInfo}>
                  {s.apiUrl}{'\n'}模型: {s.model}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => handleSelect(s.id)}
                disabled={activeId === s.id}
                activeOpacity={0.7}
                style={[
                  styles.selectBtn,
                  {
                    backgroundColor: activeId === s.id
                      ? theme['c-primary']
                      : theme['c-primary-light-100-alpha-800'],
                  },
                ]}
              >
                <Text color={activeId === s.id ? theme['c-primary-light-1000'] : theme['c-font']} size={12}>
                  {activeId === s.id ? '当前使用' : '切换到此服务'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* 添加自定义API按钮 */}
          <TouchableOpacity
            onPress={() => setShowCustomApi(true)}
            style={[styles.addCustomBtn, { backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
            activeOpacity={0.7}
          >
            <Icon name="add-music" size={14} color={theme['c-primary']} />
            <Text size={13} color={theme['c-primary']} style={{ marginLeft: 6 }}>添加自定义 API 服务</Text>
          </TouchableOpacity>

          <Text size={12} color={theme['c-font-label']} style={[styles.sectionTitle, { marginTop: 16 }]}>授权</Text>
          <TouchableOpacity
            onPress={() => setShowAuth(true)}
            style={[styles.authSectionBtn, { backgroundColor: theme['c-primary'] }]}
            activeOpacity={0.7}
          >
            <Icon name="setting" size={14} color={theme['c-primary-light-1000']} />
            <Text color={theme['c-primary-light-1000']} size={13} style={{ marginLeft: 6 }}>输入管理员密码授权（无限使用）</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* 科大讯飞自定义配置弹窗 */}
        <Modal visible={showXunfeiDetail} transparent animationType="slide" onRequestClose={() => setShowXunfeiDetail(false)}>
          <View style={styles.settingsOverlay}>
            <View style={[styles.settingsBox, { backgroundColor: theme['c-content-background'] }]}>
              <View style={[styles.settingsHeader, { borderBottomColor: theme['c-primary-light-400-alpha-800'] }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="setting" size={18} color={theme['c-primary']} />
                  <Text size={16} color={theme['c-font']} fontWeight="bold" style={{ marginLeft: 8 }}>科大讯飞配置</Text>
                </View>
                <TouchableOpacity onPress={() => setShowXunfeiDetail(false)} style={styles.closeBtn} activeOpacity={0.7}>
                  <Icon name="close" size={20} color={theme['c-font-label']} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.settingsList} showsVerticalScrollIndicator={false}>
                <View style={[styles.infoTip, { backgroundColor: theme['c-primary-light-100-alpha-900'] }]}>
                  <Icon name="help" size={12} color={theme['c-primary']} />
                  <Text size={11} color={theme['c-font-label']} style={{ marginLeft: 6, flex: 1 }}>
                    请在 https://console.xfyun.cn/app/myapp 获取以下信息
                  </Text>
                </View>
                <Text size={12} color={theme['c-font-label']} style={styles.fieldLabel}>APPID</Text>
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-900'] }]}
                  value={xunfeiConfig.appid}
                  onChangeText={(v) => setXunfeiConfig((prev) => ({ ...prev, appid: v }))}
                  placeholder="APPID"
                  placeholderTextColor={theme['c-font-label']}
                />
                <Text size={12} color={theme['c-font-label']} style={styles.fieldLabel}>API Key</Text>
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-900'] }]}
                  value={xunfeiConfig.apiKey}
                  onChangeText={(v) => setXunfeiConfig((prev) => ({ ...prev, apiKey: v }))}
                  placeholder="API Key"
                  placeholderTextColor={theme['c-font-label']}
                  secureTextEntry
                />
                <Text size={12} color={theme['c-font-label']} style={styles.fieldLabel}>API Secret</Text>
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-900'] }]}
                  value={xunfeiConfig.apiSecret}
                  onChangeText={(v) => setXunfeiConfig((prev) => ({ ...prev, apiSecret: v }))}
                  placeholder="API Secret"
                  placeholderTextColor={theme['c-font-label']}
                  secureTextEntry
                />
                <Text size={12} color={theme['c-font-label']} style={styles.fieldLabel}>WebSocket URL</Text>
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-900'] }]}
                  value={xunfeiConfig.wssUrl || 'wss://spark-api.xf-yun.com/v4.0/chat'}
                  onChangeText={(v) => setXunfeiConfig((prev) => ({ ...prev, wssUrl: v }))}
                  placeholder="WebSocket URL"
                  placeholderTextColor={theme['c-font-label']}
                />
                <Text size={12} color={theme['c-font-label']} style={[styles.fieldLabel, { marginTop: 8 }]}>选择模型</Text>
                <View style={styles.modelButtons}>
                  {XUNFEI_MODELS.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setSelectedModel(m.id)}
                      activeOpacity={0.7}
                      style={[
                        styles.modelBtn,
                        {
                          backgroundColor: selectedModel === m.id
                            ? theme['c-primary']
                            : theme['c-primary-light-100-alpha-800'],
                          borderColor: selectedModel === m.id
                            ? theme['c-primary']
                            : theme['c-primary-light-400-alpha-800'],
                        },
                      ]}
                    >
                      <Text size={11} color={selectedModel === m.id ? theme['c-primary-light-1000'] : theme['c-font']}>
                        {m.name}
                      </Text>
                      <Text size={9} color={selectedModel === m.id ? 'rgba(255,255,255,0.7)' : theme['c-font-label']}>
                        {m.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={handleSaveXunfeiConfig} style={[styles.saveBtn, { backgroundColor: theme['c-primary'] }]} activeOpacity={0.7}>
                  <Text color={theme['c-primary-light-1000']} size={14}>保存配置</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 自定义API配置弹窗 */}
        <Modal visible={showCustomApi} transparent animationType="slide" onRequestClose={() => setShowCustomApi(false)}>
          <View style={styles.settingsOverlay}>
            <View style={[styles.settingsBox, { backgroundColor: theme['c-content-background'] }]}>
              <View style={[styles.settingsHeader, { borderBottomColor: theme['c-primary-light-400-alpha-800'] }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="add-music" size={18} color={theme['c-primary']} />
                  <Text size={16} color={theme['c-font']} fontWeight="bold" style={{ marginLeft: 8 }}>添加自定义 API</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCustomApi(false)} style={styles.closeBtn} activeOpacity={0.7}>
                  <Icon name="close" size={20} color={theme['c-font-label']} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.settingsList} showsVerticalScrollIndicator={false}>
                <View style={[styles.infoTip, { backgroundColor: theme['c-primary-light-100-alpha-900'] }]}>
                  <Icon name="help" size={12} color={theme['c-primary']} />
                  <Text size={11} color={theme['c-font-label']} style={{ marginLeft: 6, flex: 1 }}>
                    支持所有 OpenAI 兼容的 API 接口
                  </Text>
                </View>
                <Text size={12} color={theme['c-font-label']} style={styles.fieldLabel}>服务名称</Text>
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-900'] }]}
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="例如：我的AI服务"
                  placeholderTextColor={theme['c-font-label']}
                />
                <Text size={12} color={theme['c-font-label']} style={styles.fieldLabel}>API 地址</Text>
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-900'] }]}
                  value={customUrl}
                  onChangeText={setCustomUrl}
                  placeholder="https://api.example.com/v1/chat/completions"
                  placeholderTextColor={theme['c-font-label']}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text size={12} color={theme['c-font-label']} style={styles.fieldLabel}>模型名称</Text>
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-900'] }]}
                  value={customModel}
                  onChangeText={setCustomModel}
                  placeholder="例如：gpt-4o-mini, qwen-turbo"
                  placeholderTextColor={theme['c-font-label']}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text size={12} color={theme['c-font-label']} style={styles.fieldLabel}>API Key</Text>
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-800'], backgroundColor: theme['c-primary-light-100-alpha-900'] }]}
                  value={customKey}
                  onChangeText={setCustomKey}
                  placeholder="sk-xxxxxxxx"
                  placeholderTextColor={theme['c-font-label']}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={handleAddCustomService}
                  style={[styles.saveBtn, { backgroundColor: theme['c-primary'], marginTop: 16 }]}
                  activeOpacity={0.7}
                >
                  <Text color={theme['c-primary-light-1000']} size={14}>保存</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 管理员授权弹窗 */}
        <Modal visible={showAuth} transparent animationType="fade" onRequestClose={() => setShowAuth(false)}>
          <View style={styles.authOverlay}>
            <View style={[styles.authBox, { backgroundColor: theme['c-content-background'] }]}>
              <View style={styles.authIconWrap}>
                <View style={[styles.authIconCircle, { backgroundColor: theme['c-primary'] }]}>
                  <Icon name="setting" color={theme['c-primary-light-1000']} size={20} />
                </View>
              </View>
              <Text size={16} color={theme['c-font']} fontWeight="bold" style={styles.authTitle}>
                管理员授权
              </Text>
              <Text size={12} color={theme['c-font-label']} style={styles.authDesc}>
                输入管理员密码解锁无限对话次数
              </Text>
              <TextInput
                style={[styles.authInput, { color: theme['c-font'], backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: theme['c-primary-light-400-alpha-800'] }]}
                value={authPwd}
                onChangeText={setAuthPwd}
                placeholder="请输入管理员密码"
                placeholderTextColor={theme['c-font-label']}
                secureTextEntry
                onSubmitEditing={handleAuth}
              />
              <View style={styles.authBtns}>
                <TouchableOpacity
                  onPress={() => setShowAuth(false)}
                  style={[styles.authBtn, { backgroundColor: theme['c-primary-light-100-alpha-800'] }]}
                  activeOpacity={0.7}
                >
                  <Text color={theme['c-font']} size={14}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAuth}
                  style={[styles.authBtn, { backgroundColor: theme['c-primary'] }]}
                  activeOpacity={0.7}
                >
                  <Text color={theme['c-primary-light-1000']} size={14}>确认</Text>
                </TouchableOpacity>
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
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontWeight: 'bold' },
  quotaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  quotaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  msgList: {
    padding: 14,
    paddingBottom: 20,
    paddingTop: 16,
  },
  msgRow: {
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  msgRowUser: { justifyContent: 'flex-end', flexDirection: 'row-reverse' },
  msgRowAI: { justifyContent: 'flex-start' },
  msgAvatarWrap: {
    width: 34,
    height: 34,
    flexShrink: 0,
  },
  msgAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  msgBubble: {
    maxWidth: '76%',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    borderTopWidth: 1,
    paddingBottom: 12,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 32,
    maxHeight: 100,
    fontSize: 14,
    padding: 0,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  authOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  authBox: {
    width: '100%',
    borderRadius: 16,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  authIconWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  authIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTitle: { textAlign: 'center', marginBottom: 8 },
  authDesc: { textAlign: 'center', marginBottom: 18, lineHeight: 18 },
  authInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  authBtns: { flexDirection: 'row', gap: 10 },
  authBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  settingsBox: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsList: { maxHeight: 480 },
  sectionTitle: {
    marginTop: 6,
    marginBottom: 10,
    fontWeight: '600',
  },
  serviceItem: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xunfeiCustomSection: {
    marginBottom: 8,
  },
  detailBtn: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  keyInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 8,
  },
  apiInfo: {
    marginTop: 4,
    marginBottom: 6,
    lineHeight: 16,
  },
  selectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addCustomBtn: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  authSectionBtn: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoTip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  fieldLabel: {
    marginTop: 6,
    marginBottom: 6,
  },
  modelButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  modelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
})

export default MusicAssistant
