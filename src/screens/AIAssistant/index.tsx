// @ts-nocheck
/**
 * 全新设计的 AI 音乐助手界面
 * 特性：毛玻璃顶部、渐变气泡、听歌识曲、工具动画
 */
import { useState, useRef, useCallback, useEffect, memo, useImperativeHandle, forwardRef } from 'react'
import {
  View, TextInput, FlatList, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, Alert, ScrollView, TouchableOpacity,
  Animated, Easing, Text as RNText, PermissionsAndroid, Platform as RNPlatform,
  StyleSheet,
} from 'react-native'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { chat, getActiveServiceId, setActiveService, getPresetServices, getUserApiKey, setUserApiKey, initAiService } from '@/core/ai'
import { checkQuota, authorize, getRemainingQuota, isAuthorized } from '@/core/ai/quota'
import { getUserXunfeiConfig, setUserXunfeiConfig, XUNFEI_MODELS } from '@/core/ai/config'
import type { ChatMessage as AIChatMessage } from '@/core/ai/providers/xunfei'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { HEADER_HEIGHT } from '@/config/constant'
import { toolPlayMusic } from '@/core/ai/tools'

// ============ 工具名称中文映射 ============
const TOOL_NAME_CN: Record<string, string> = {
  search_music: '🔍 搜索歌曲',
  play_music: '▶️ 播放音乐',
  download_music: '⬇️ 下载音乐',
  get_lyrics: '📝 获取歌词',
  navigate: '🧭 导航页面',
  get_current_song: '🎧 当前歌曲',
  control_player: '🎛️ 控制播放',
  set_volume: '🔊 调节音量',
  search_album: '💿 搜索专辑',
  search_artist: '👤 搜索歌手',
  add_to_love: '❤️ 收藏歌曲',
  execute_sequence: '⚡ 批量操作',
  shazam: '🎤 听歌识曲',
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
  loading?: boolean
}

interface ShazamResult {
  title: string
  artist: string
  coverUrl?: string
}

const MusicAssistant = () => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const flatListRef = useRef<FlatList>(null)

  // 渐变动画值
  const gradientAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(gradientAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      })
    ).start()
  }, [])

  const gradientColor = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#6366f1', '#8b5cf6'],
  })

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的音乐助手 ✨\n\n我可以帮你：\n• 🎵 搜索播放歌曲\n• ⬇️ 下载无损音乐\n• 📝 查找歌词\n• 🎤 听歌识曲\n\n有什么想听的？',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authPwd, setAuthPwd] = useState('')
  const [remaining, setRemaining] = useState<number>(-1)
  const [authorized, setAuthorized] = useState(false)

  // 听歌识曲状态
  const [shazamState, setShazamState] = useState<'idle' | 'recording' | 'recognizing' | 'done' | 'error'>('idle')
  const [shazamResult, setShazamResult] = useState<ShazamResult | null>(null)
  const [shazamError, setShazamError] = useState('')
  const waveAnim = useRef(new Animated.Value(0)).current

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

  // 听歌识曲动画
  useEffect(() => {
    if (shazamState === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(waveAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      ).start()
    } else {
      waveAnim.setValue(0)
    }
  }, [shazamState])

  // 请求麦克风权限
  const requestMicPermission = async (): Promise<boolean> => {
    if (RNPlatform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: '麦克风权限',
            message: '音乐助手需要麦克风权限来识别正在播放的歌曲',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '允许',
          }
        )
        return granted === PermissionsAndroid.RESULTS.GRANTED
      } catch {
        return false
      }
    }
    return true
  }

  // 听歌识曲
  const handleShazam = async () => {
    if (shazamState === 'recording') {
      setShazamState('idle')
      return
    }

    const hasPermission = await requestMicPermission()
    if (!hasPermission) {
      Alert.alert('权限不足', '需要麦克风权限才能使用听歌识曲功能')
      return
    }

    setShazamState('recording')
    setShazamError('')
    setShazamResult(null)

    // 5秒录音后自动开始识别
    setTimeout(async () => {
      setShazamState('recognizing')
      try {
        const { recognizeFromMic } = await import('@/core/shazam')
        const result = await recognizeFromMic(5)
        if (result) {
          setShazamResult(result)
          setShazamState('done')
          setMessages(prev => [...prev, {
            id: `s_${Date.now()}`,
            role: 'assistant',
            content: `🎤 识别结果：\n\n**${result.title}** - ${result.artist}\n\n是否播放这首歌？`,
          }])
        } else {
          setShazamError('未能识别到歌曲，可能是环境太嘈杂或歌曲不在曲库中')
          setShazamState('error')
        }
      } catch (err: any) {
        setShazamError(err.message || '识别失败，请重试')
        setShazamState('error')
      }
    }, 5000)
  }

  // 播放识别结果
  const handlePlayRecognized = async () => {
    if (!shazamResult) return
    setShazamState('idle')
    setMessages(prev => [...prev, {
      id: `u_${Date.now()}`,
      role: 'user',
      content: `播放《${shazamResult.title}》`,
    }, {
      id: `t_${Date.now()}`,
      role: 'tool',
      toolName: 'play_music',
      content: '',
      loading: true,
    }])
    try {
      const result = await toolPlayMusic(`${shazamResult.title} ${shazamResult.artist}`)
      setMessages(prev => prev.map(m =>
        m.loading ? { ...m, content: `▶️ ${result}`, loading: false } : m
      ))
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.loading ? { ...m, content: `❌ ${err.message}`, loading: false } : m
      ))
    }
  }

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
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setSending(true)

    const history: AIChatMessage[] = messages
      .filter(m => !m.loading && m.content)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    let chunkBuffer = ''
    try {
      const result = await chat(
        text,
        history,
        chunk => {
          chunkBuffer += chunk
          setMessages(prev =>
            prev.map(m => m.id === assistantMsg.id ? { ...m, content: chunkBuffer, loading: false } : m)
          )
        },
        (toolName, toolResult) => {
          setMessages(prev => [
            ...prev,
            {
              id: `t_${Date.now()}`,
              role: 'tool',
              toolName,
              content: `${TOOL_NAME_CN[toolName] || toolName}\n${toolResult}`,
            },
          ])
        }
      )
      setMessages(prev =>
        prev.map(m => m.id === assistantMsg.id ? { ...m, content: result || chunkBuffer, loading: false } : m)
      )
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m => m.id === assistantMsg.id ? { ...m, content: `❌ ${err.message}`, loading: false } : m)
      )
      if (err.message?.includes('管理员密码')) setShowAuth(true)
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
      Alert.alert('', '授权成功，已解锁无限对话')
      refreshQuota()
    } else {
      Alert.alert('', '密码错误')
    }
  }

  // 渲染工具执行消息
  const renderToolMessage = (item: Message) => (
    <View style={[styles.toolCard, { backgroundColor: theme['c-primary-light-100-alpha-20'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
      <View style={styles.toolCardHeader}>
        <Text size={12} color={theme['c-primary']} fontWeight="bold">
          {TOOL_NAME_CN[item.toolName!] || item.toolName}
        </Text>
        {item.loading && <ActivityIndicator color={theme['c-primary']} size="small" />}
      </View>
      <Text size={13} color={theme['c-font-label']} style={{ marginTop: 4 }}>
        {item.loading ? '执行中...' : item.content.replace(/^[^\n]+\n/, '')}
      </Text>
    </View>
  )

  // 渲染普通消息气泡
  const renderBubble = (item: Message) => {
    const isUser = item.role === 'user'
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
        {/* 头像 */}
        <View style={[styles.msgAvatarWrap, isUser && styles.msgAvatarWrapUser]}>
          <View style={[styles.msgAvatar, {
            backgroundColor: isUser ? theme['c-primary'] : theme['c-primary-light-400-alpha-600'],
          }]}>
            <Text size={16}>{isUser ? '😊' : '🎵'}</Text>
          </View>
        </View>
        {/* 气泡 */}
        <View style={[
          styles.msgBubble,
          isUser ? styles.msgBubbleUser : styles.msgBubbleAI,
          {
            backgroundColor: isUser
              ? (theme['c-primary'] as string)
              : (theme['c-content-background'] as string),
            borderColor: isUser
              ? theme['c-primary']
              : theme['c-primary-light-400-alpha-40'],
          },
        ]}>
          {item.loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={isUser ? '#fff' : theme['c-primary']} size="small" />
              <Text size={14} color={isUser ? 'rgba(255,255,255,0.7)' : theme['c-font-label']} style={{ marginLeft: 8 }}>
                思考中...
              </Text>
            </View>
          ) : (
            <Text
              style={styles.msgText}
              color={isUser ? '#fff' : theme['c-font']}
            >
              {item.content}
            </Text>
          )}
        </View>
      </View>
    )
  }

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.role === 'tool') return renderToolMessage(item)
    return renderBubble(item)
  }

  const waveScale = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] })
  const waveOpacity = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0.2] })

  return (
    <View style={[styles.container, { backgroundColor: theme['c-background'] }]}>
      {/* ========== 顶部区域 ========== */}
      <Animated.View style={[
        styles.topSection,
        { paddingTop: statusBarHeight, backgroundColor: gradientColor },
      ]}>
        {/* 毛玻璃遮罩 */}
        <View style={styles.topOverlay} />
        <View style={styles.topContent}>
          <View style={styles.topLeft}>
            {/* Logo */}
            <View style={styles.logoWrap}>
              <Icon name="music" color="#fff" size={24} />
            </View>
            <View>
              <Text color="#fff" size={18} fontWeight="bold">音乐助手</Text>
              <Text size={11} color="rgba(255,255,255,0.7)">
                {authorized ? '✨ 已授权无限使用' : remaining >= 0 ? `${remaining} 次免费对话` : '加载中...'}
              </Text>
            </View>
          </View>
          <View style={styles.topRight}>
            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              style={styles.topBtn}
            >
              <Icon name="setting" color="#fff" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* ========== 听歌识曲区域 ========== */}
      <View style={[styles.shazamBar, { backgroundColor: theme['c-content-background'] }]}>
        <TouchableOpacity
          onPress={handleShazam}
          disabled={sending}
          style={[
            styles.shazamBtn,
            shazamState === 'recording' && styles.shazamBtnActive,
            shazamState === 'done' && styles.shazamBtnDone,
            { backgroundColor: shazamState === 'idle' ? theme['c-primary'] : shazamState === 'recording' ? '#ef4444' : shazamState === 'done' ? '#22c55e' : theme['c-primary'] },
          ]}
        >
          {shazamState === 'recording' ? (
            <View style={styles.shazamRecording}>
              <Animated.View style={[styles.waveRing, {
                transform: [{ scale: waveScale }],
                opacity: waveOpacity,
                backgroundColor: '#ef4444',
              }]} />
              <Icon name="mic" color="#fff" size={20} />
            </View>
          ) : shazamState === 'recognizing' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.shazamIdle}>
              <Icon name="mic" color="#fff" size={20} />
            </View>
          )}
          <Text color="#fff" size={13} fontWeight="bold">
            {shazamState === 'idle' ? '听歌识曲' :
              shazamState === 'recording' ? '点击停止' :
                shazamState === 'recognizing' ? '识别中...' :
                  shazamState === 'done' ? '识别成功' : '识别失败'}
          </Text>
        </TouchableOpacity>

        {shazamState === 'recording' && (
          <Text size={12} color="#ef4444" style={{ marginLeft: 12 }}>
            🔴 录音中，请保持环境安静...
          </Text>
        )}

        {shazamState === 'done' && shazamResult && (
          <View style={styles.shazamResultRow}>
            <Text size={12} color={theme['c-font']} numberOfLines={1} style={{ flex: 1 }}>
              《{shazamResult.title}》- {shazamResult.artist}
            </Text>
            <TouchableOpacity onPress={handlePlayRecognized} style={styles.shazamPlayBtn}>
              <Icon name="play-circle" color={theme['c-primary']} size={22} />
            </TouchableOpacity>
          </View>
        )}

        {shazamState === 'error' && (
          <Text size={12} color="#ef4444" style={{ marginLeft: 12, flex: 1 }} numberOfLines={2}>
            {shazamError}
          </Text>
        )}
      </View>

      {/* ========== 消息列表 ========== */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.msgList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />

      {/* ========== 输入区域 ========== */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.inputBar, {
          backgroundColor: theme['c-content-background'],
          borderTopColor: theme['c-primary-light-400-alpha-40'],
        }]}>
          <View style={[styles.inputWrap, {
            backgroundColor: theme['c-primary-light-100-alpha-30'],
            borderColor: theme['c-primary-light-400-alpha-40'],
          }]}>
            <TextInput
              style={[styles.input, { color: theme['c-font'] }]}
              value={input}
              onChangeText={setInput}
              placeholder="跟我说点什么..."
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
              backgroundColor: sending || !input.trim()
                ? theme['c-primary-light-100-alpha-30']
                : theme['c-primary'],
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

      {/* 授权弹窗 */}
      <Modal visible={showAuth} transparent animationType="fade" onRequestClose={() => setShowAuth(false)}>
        <View style={styles.authOverlay}>
          <View style={[styles.authBox, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
            <Text size={20} color={theme['c-font']} style={styles.authTitle} fontWeight="bold">🔐 管理员授权</Text>
            <Text size={14} color={theme['c-font-label']} style={styles.authDesc}>免费对话次数已用完，请输入密码解锁</Text>
            <TextInput
              style={[styles.authInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-600'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
              value={authPwd}
              onChangeText={setAuthPwd}
              placeholder="输入管理员密码"
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

// ============ 设置弹窗 ============
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
    services.forEach(s => {
      const key = getUserApiKey(s.id)
      if (key) setApiKeys(prev => ({ ...prev, [s.id]: key }))
    })
  }, [services])

  const handleSelect = async (id: string) => {
    await setActiveService(id)
    setActiveId(id)
  }

  const handleSaveKey = async (id: string, key: string) => {
    await setUserApiKey(id, key)
    setApiKeys(prev => ({ ...prev, [id]: key }))
  }

  const handleSaveXunfeiConfig = () => {
    setUserXunfeiConfig({ ...xunfeiConfig, model: selectedModel })
    Alert.alert('', '科大讯飞配置已保存')
    setShowXunfeiDetail(false)
  }

  const handleAuth = async () => {
    const ok = await authorize(authPwd)
    if (ok) {
      Alert.alert('', '授权成功')
      setShowAuth(false)
      setAuthPwd('')
      onRefresh()
    } else {
      Alert.alert('', '密码错误')
    }
  }

  return (
    <View style={styles.settingsOverlay}>
      <View style={[styles.settingsBox, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
        <View style={styles.settingsHeader}>
          <Text size={20} color={theme['c-font']} fontWeight="bold">⚙️ AI 设置</Text>
          <Button onPress={onClose} style={styles.closeBtn}>
            <Text color={theme['c-font-label']} size={24}>✕</Text>
          </Button>
        </View>
        <ScrollView style={styles.settingsList} showsVerticalScrollIndicator={false}>
          {services.map(s => (
            <View key={s.id} style={[styles.serviceItem, {
              borderColor: activeId === s.id ? theme['c-primary'] : 'transparent',
              backgroundColor: theme['c-primary-light-100-alpha-20'],
            }]}>
              <View style={styles.serviceHeader}>
                <View>
                  <Text size={15} color={theme['c-font']} fontWeight="500">{s.name}</Text>
                  <Text size={11} color={theme['c-font-label']}>{s.id}</Text>
                </View>
                {s.builtin ? (
                  <View style={[styles.badge, { backgroundColor: theme['c-primary'] }]}>
                    <Text size={10} color="#fff">内置</Text>
                  </View>
                ) : null}
              </View>
              {s.id === 'xunfei_custom' ? (
                <TouchableOpacity onPress={() => setShowXunfeiDetail(true)} style={[styles.detailBtn, { backgroundColor: theme['c-primary-light-100-alpha-40'] }]}>
                  <Text size={13} color={theme['c-font-label']}>
                    {xunfeiConfig.appid ? '✓ 已配置 - 点击修改' : '+ 点击配置讯飞应用'}
                  </Text>
                </TouchableOpacity>
              ) : !s.builtin ? (
                <TextInput
                  style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-40'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
                  value={apiKeys[s.id] || ''}
                  onChangeText={v => setApiKeys(prev => ({ ...prev, [s.id]: v }))}
                  placeholder={`API Key`}
                  placeholderTextColor={theme['c-font-label']}
                  secureTextEntry
                  onBlur={() => handleSaveKey(s.id, apiKeys[s.id] || '')}
                />
              ) : null}
              <TouchableOpacity
                onPress={() => handleSelect(s.id)}
                disabled={activeId === s.id}
                style={[styles.selectBtn, {
                  backgroundColor: activeId === s.id ? theme['c-primary'] : 'transparent',
                  borderColor: activeId === s.id ? theme['c-primary'] : theme['c-primary-light-400-alpha-40'],
                }]}
              >
                <Text color={activeId === s.id ? '#fff' : theme['c-font']} size={13}>
                  {activeId === s.id ? '✓ 当前使用' : '切换使用'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* 授权按钮 */}
          <TouchableOpacity onPress={() => setShowAuth(true)} style={[styles.authBtnFull, { backgroundColor: theme['c-primary'] }]}>
            <Text color="#fff" size={14}>🔐 输入管理员密码（无限对话）</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* 讯飞配置子弹窗 */}
        <Modal visible={showXunfeiDetail} transparent animationType="slide" onRequestClose={() => setShowXunfeiDetail(false)}>
          <View style={styles.settingsOverlay}>
            <View style={[styles.settingsBox, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
              <View style={styles.settingsHeader}>
                <Text size={18} color={theme['c-font']} fontWeight="bold">📝 讯飞配置</Text>
                <Button onPress={() => setShowXunfeiDetail(false)} style={styles.closeBtn}>
                  <Text color={theme['c-font-label']} size={24}>✕</Text>
                </Button>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[styles.tipBox, { backgroundColor: theme['c-primary-light-100-alpha-20'] }]}>
                  <Text size={12} color={theme['c-font-label']}>
                    💡 前往 https://console.xfyun.cn/app/myapp 获取凭证
                  </Text>
                </View>
                {['APPID', 'API Key', 'API Secret'].map((label, i) => (
                  <TextInput
                    key={label}
                    style={[styles.keyInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-40'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
                    value={[xunfeiConfig.appid, xunfeiConfig.apiKey, xunfeiConfig.apiSecret][i]}
                    onChangeText={v => {
                      const keys = ['appid', 'apiKey', 'apiSecret']
                      setXunfeiConfig(prev => ({ ...prev, [keys[i]]: v }))
                    }}
                    placeholder={label}
                    placeholderTextColor={theme['c-font-label']}
                    secureTextEntry={i > 0}
                  />
                ))}
                <Text size={13} color={theme['c-font']} style={{ marginBottom: 8 }}>选择模型：</Text>
                <View style={styles.modelButtons}>
                  {XUNFEI_MODELS.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setSelectedModel(m.id)}
                      style={[styles.modelBtn, {
                        backgroundColor: selectedModel === m.id ? theme['c-primary'] : theme['c-primary-light-100-alpha-40'],
                      }]}
                    >
                      <Text size={12} color={selectedModel === m.id ? '#fff' : theme['c-font']}>{m.name}</Text>
                      <Text size={10} color={selectedModel === m.id ? 'rgba(255,255,255,0.7)' : theme['c-font-label']}>{m.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={handleSaveXunfeiConfig} style={[styles.saveBtn, { backgroundColor: theme['c-primary'] }]}>
                  <Text color="#fff" size={14}>保存</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 授权弹窗 */}
        <Modal visible={showAuth} transparent animationType="fade" onRequestClose={() => setShowAuth(false)}>
          <View style={styles.authOverlay}>
            <View style={[styles.authBox, { backgroundColor: theme['c-content-background'], borderColor: theme['c-primary-light-400-alpha-40'] }]}>
              <Text size={18} color={theme['c-font']} style={styles.authTitle} fontWeight="bold">🔐 管理员授权</Text>
              <TextInput
                style={[styles.authInput, { color: theme['c-font'], borderColor: theme['c-primary-light-400-alpha-600'], backgroundColor: theme['c-primary-light-100-alpha-20'] }]}
                value={authPwd}
                onChangeText={setAuthPwd}
                placeholder="管理员密码"
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
  // 顶部区域
  topSection: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  topOverlay: {
    ...StyleSheet.absoluteFill(),
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  topContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center' },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 听歌识曲条
  shazamBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  shazamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shazamBtnActive: { backgroundColor: '#ef4444' },
  shazamBtnDone: { backgroundColor: '#22c55e' },
  shazamIdle: { marginRight: 6 },
  shazamRecording: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
    width: 24,
    height: 24,
    justifyContent: 'center',
  },
  waveRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  shazamResultRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  shazamPlayBtn: { marginLeft: 8, padding: 2 },
  // 消息列表
  msgList: { padding: 16, paddingBottom: 100, paddingTop: 20 },
  msgRow: { marginBottom: 16, flexDirection: 'row', alignItems: 'flex-end' },
  msgRowUser: { flexDirection: 'row-reverse' },
  msgRowAI: {},
  msgAvatarWrap: { marginRight: 8 },
  msgAvatarWrapUser: { marginRight: 0, marginLeft: 8 },
  msgAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgBubble: {
    maxWidth: '75%',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  msgBubbleUser: {
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 18,
  },
  msgBubbleAI: {
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 15, lineHeight: 22 },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  // 工具执行卡片
  toolCard: {
    marginBottom: 12,
    marginLeft: 44,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  toolCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // 输入区
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    paddingBottom: 36,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  input: { flex: 1, minHeight: 40, maxHeight: 120, fontSize: 15 },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  // 授权弹窗
  authOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 30,
  },
  authBox: {
    width: '100%', borderRadius: 20, padding: 24, borderWidth: 1,
  },
  authTitle: { textAlign: 'center', marginBottom: 12 },
  authDesc: { textAlign: 'center', marginBottom: 16 },
  authInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, marginBottom: 16,
  },
  authBtns: { flexDirection: 'row', justifyContent: 'space-around' },
  authBtn: {
    flex: 1, marginHorizontal: 8, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  authBtnFull: {
    marginTop: 16, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  // 设置弹窗
  settingsOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  settingsBox: {
    width: '100%', maxHeight: '88%', borderRadius: 20, padding: 20, borderWidth: 1,
  },
  settingsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18,
  },
  closeBtn: { padding: 4 },
  settingsList: { maxHeight: 480 },
  serviceItem: {
    padding: 14, marginBottom: 12, borderRadius: 16, borderWidth: 2,
  },
  serviceHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  detailBtn: { padding: 10, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  keyInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 10,
  },
  selectBtn: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1,
  },
  tipBox: { padding: 10, borderRadius: 10, marginBottom: 12 },
  modelButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  modelBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, alignItems: 'center',
  },
  saveBtn: {
    paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 20,
  },
})

export default MusicAssistant
