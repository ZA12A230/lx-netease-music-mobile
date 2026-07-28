/**
 * 实验室功能管理模块
 * 集中管理实验性特性的开关和元数据
 */
import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'

export interface LabFeature {
  key: keyof LX.AppSetting
  name: string
  description: string
  icon: string
  risk: 'low' | 'medium' | 'high'
  category: 'player' | 'recommendation' | 'ui' | 'ai' | 'tool' | 'game' | 'lifestyle'
}

/** 实验室功能列表 */
export const LAB_FEATURES: LabFeature[] = [
  {
    key: 'lab.smartMoodRecommend',
    name: '智能心情推荐',
    description: '根据你的听歌历史和当前时间，AI自动生成符合你心情的歌单',
    icon: '🧠',
    risk: 'low',
    category: 'recommendation',
  },
  {
    key: 'lab.musicStatsDashboard',
    name: '音乐统计仪表盘',
    description: '可视化展示你的听歌数据：时长趋势、风格分布、最爱歌手等',
    icon: '📊',
    risk: 'low',
    category: 'ui',
  },
  {
    key: 'lab.djMode',
    name: 'DJ 模式',
    description: '自动混音模式：歌曲间无缝衔接、节拍同步、淡入淡出',
    icon: '🎧',
    risk: 'medium',
    category: 'player',
  },
  {
    key: 'lab.moodDiary',
    name: '音乐心情日记',
    description: '记录每天的心情和对应的歌曲，形成你的音乐情感时间线',
    icon: '📔',
    risk: 'low',
    category: 'ui',
  },
  {
    key: 'lab.gestureControl',
    name: '手势快捷操作',
    description: '双击播放/暂停、左右滑动切歌、上下滑动调音量',
    icon: '👆',
    risk: 'low',
    category: 'ui',
  },
  {
    key: 'lab.lyricTimelineEditor',
    name: '歌词时间轴编辑器',
    description: '手动调整歌词与音乐的同步时间，修复错位的歌词',
    icon: '✏️',
    risk: 'medium',
    category: 'player',
  },
  {
    key: 'lab.crossfade',
    name: '歌曲交叉淡化',
    description: '歌曲切换时音频平滑过渡，避免突兀的停顿',
    icon: '🌊',
    risk: 'medium',
    category: 'player',
  },
  {
    key: 'lab.spectrumVisualizer',
    name: '频谱可视化',
    description: '播放界面显示实时音频频谱动画',
    icon: '🎵',
    risk: 'low',
    category: 'ui',
  },
  {
    key: 'lab.aiPlaylistGenerator',
    name: 'AI 歌单生成器',
    description: '用自然语言描述想要的歌单，AI自动生成对应歌单',
    icon: '🤖',
    risk: 'low',
    category: 'ai',
  },
  // ============ V2 新增功能 ============
  {
    key: 'lab.karaokeMode',
    name: '卡拉OK模式',
    description: 'KTV风格歌词显示，降低原唱音量，演唱评分系统',
    icon: '🎤',
    risk: 'medium',
    category: 'player',
  },
  {
    key: 'lab.similarityRecommend',
    name: '相似歌曲推荐',
    description: '基于歌手、流派、BPM、能量等特征计算歌曲相似度并推荐',
    icon: '🎯',
    risk: 'low',
    category: 'recommendation',
  },
  {
    key: 'lab.listeningChallenge',
    name: '听歌挑战',
    description: '每日/每周听歌挑战目标，完成解锁徽章，激励探索新音乐',
    icon: '🏆',
    risk: 'low',
    category: 'ui',
  },
  {
    key: 'lab.musicMap',
    name: '音乐地图',
    description: '基于位置的音乐记忆，记录在何处听了什么歌，形成音乐足迹',
    icon: '🗺️',
    risk: 'medium',
    category: 'ui',
  },
  {
    key: 'lab.smartSkip',
    name: '智能跳过',
    description: '自动学习跳过习惯，根据规则跳过不喜欢的歌曲，节省时间',
    icon: '⏭️',
    risk: 'low',
    category: 'player',
  },
  {
    key: 'lab.audioEnhancer',
    name: '音效增强',
    description: '虚拟低音、空间音频、响度归一化等多种音效增强功能',
    icon: '🔊',
    risk: 'medium',
    category: 'player',
  },
  {
    key: 'lab.listeningGoals',
    name: '听歌目标打卡',
    description: '自定义每日/每周/每月听歌目标，连续打卡养成习惯',
    icon: '📅',
    risk: 'low',
    category: 'ui',
  },
  {
    key: 'lab.musicLearning',
    name: '音乐学习模式',
    description: '从歌词提取单词，艾宾浩斯记忆法复习，听力测验学习外语',
    icon: '📚',
    risk: 'low',
    category: 'ai',
  },
  {
    key: 'lab.shareCard',
    name: '音乐分享卡片',
    description: '生成精美音乐分享卡片，10种模板风格，可分享到社交平台',
    icon: '🎴',
    risk: 'low',
    category: 'ui',
  },
  // ============ V3 新增功能 ============
  {
    key: 'lab.collaborativeFilter',
    name: '协同过滤推荐',
    description: '基于用户行为相似度推荐歌曲，发现更多喜欢的音乐',
    icon: '🔍',
    risk: 'low',
    category: 'recommendation',
  },
  {
    key: 'lab.playlistOrganizer',
    name: '智能歌单整理',
    description: '按歌手、风格、情绪等多维度自动分类整理歌单',
    icon: '📋',
    risk: 'low',
    category: 'tool',
  },
  {
    key: 'lab.musicRadar',
    name: '音乐发现雷达',
    description: '多维度音乐发现：趋势、新发布、被遗忘的歌曲、跨平台、季节推荐',
    icon: '📡',
    risk: 'low',
    category: 'recommendation',
  },
  {
    key: 'lab.lyricTranslator',
    name: '歌词多语言翻译',
    description: '支持10种语言歌词翻译，AI智能翻译并附带词汇注释',
    icon: '🌐',
    risk: 'low',
    category: 'ai',
  },
  {
    key: 'lab.timeMachine',
    name: '音乐时光机',
    description: '回顾X年前的今天你听过的音乐，重拾美好回忆',
    icon: '⏰',
    risk: 'low',
    category: 'ui',
  },
  {
    key: 'lab.smartSleepTimer',
    name: '智能睡眠定时',
    description: '基于睡眠周期的智能定时：90分钟周期、淡出、歌曲结束、智能识别',
    icon: '😴',
    risk: 'low',
    category: 'lifestyle',
  },
  {
    key: 'lab.meditationMode',
    name: '冥想模式',
    description: '呼吸引导、专注计时，多种冥想模式助你放松身心',
    icon: '🧘',
    risk: 'low',
    category: 'lifestyle',
  },
  {
    key: 'lab.runningMode',
    name: 'BPM 跑步模式',
    description: '根据步频匹配BPM，自动选择适合热身、慢跑、冲刺的音乐',
    icon: '🏃',
    risk: 'low',
    category: 'lifestyle',
  },
  {
    key: 'lab.emotionAnalysis',
    name: '歌曲情绪AI分析',
    description: 'AI分析歌曲的情绪、能量、氛围，可视化展示情绪光谱',
    icon: '🎭',
    risk: 'medium',
    category: 'ai',
  },
  {
    key: 'lab.musicKnowledge',
    name: '音乐知识库',
    description: 'AI提供歌曲背景知识、创作故事、制作信息、文化影响等',
    icon: '📖',
    risk: 'low',
    category: 'ai',
  },
  {
    key: 'lab.artistGraph',
    name: '歌手关系图谱',
    description: '构建歌手合作关系图谱，分析风格相似度和合作强度',
    icon: '🕸️',
    risk: 'low',
    category: 'tool',
  },
  {
    key: 'lab.playlistRepair',
    name: '智能歌单修复',
    description: '检测并修复歌单中的重复、缺失信息、低质量等问题歌曲',
    icon: '🔧',
    risk: 'low',
    category: 'tool',
  },
  {
    key: 'lab.musicQuiz',
    name: '音乐知识问答',
    description: '基于你的歌单生成知识问答游戏，4种题型、4种难度',
    icon: '🎮',
    risk: 'low',
    category: 'game',
  },
]

/** 检查实验室功能是否启用 */
export const isLabEnabled = (): boolean => {
  return !!settingState.setting['lab.enabled']
}

/** 检查某个实验特性是否启用 */
export const isFeatureEnabled = (key: LabFeature['key']): boolean => {
  if (!isLabEnabled()) return false
  return !!settingState.setting[key]
}

/** 启用/禁用实验室 */
export const setLabEnabled = async (enabled: boolean) => {
  await updateSetting({ 'lab.enabled': enabled })
  if (!enabled) {
    // 关闭实验室时，禁用所有实验特性
    const updates: Partial<LX.AppSetting> = { 'lab.enabled': false }
    for (const feature of LAB_FEATURES) {
      ;(updates as any)[feature.key] = false
    }
    await updateSetting(updates)
  }
}

/** 切换单个实验特性 */
export const toggleFeature = async (key: LabFeature['key'], enabled: boolean) => {
  if (enabled && !isLabEnabled()) {
    await setLabEnabled(true)
  }
  await updateSetting({ [key]: enabled } as any)
}

/** 按类别分组获取功能 */
export const getFeaturesByCategory = (): Record<LabFeature['category'], LabFeature[]> => {
  const result: Record<LabFeature['category'], LabFeature[]> = {
    player: [],
    recommendation: [],
    ui: [],
    ai: [],
    tool: [],
    game: [],
    lifestyle: [],
  }
  for (const feature of LAB_FEATURES) {
    result[feature.category].push(feature)
  }
  return result
}
