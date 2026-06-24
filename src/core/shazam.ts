/**
 * 听歌识曲模块 (v3.x API)
 * 使用 Shazam API 进行音乐识别
 * 依赖 react-native-audio-recorder-player 进行麦克风录制
 */
import axios from 'axios'

/**
 * 从本地音频文件识别歌曲
 */
export const recognizeFromFile = async (filePath: string): Promise<{
  title: string
  artist: string
  coverUrl?: string
} | null> => {
  try {
    // 动态导入 RNFS
    let RNFS: any
    try {
      RNFS = await import('react-native-fs')
      RNFS = RNFS.default || RNFS
    } catch {
      RNFS = null
    }

    let audioBase64: string
    if (RNFS && typeof RNFS.readFile === 'function') {
      audioBase64 = await RNFS.readFile(filePath, 'base64')
    } else {
      // 备选：直接用 fetch（如果传入的是可访问的 URI）
      const resp = await fetch(filePath)
      const blob = await resp.blob()
      audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }

    // 构建 Shazam 检测请求
    const body = {
      uri: `data:audio/mpeg;base64,${audioBase64.substring(0, 8000)}`,
      dttm: new Date().toISOString(),
      timezone: 'Asia/Shanghai',
    }

    const resp = await axios.post(
      'https://www.shazam.com/services/shazam-seo/v3/detect',
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shazam-Platform': 'IOS',
          'X-Shazam-Application-Version': '14.18.0',
        },
        timeout: 15000,
      }
    )

    const matches = resp.data?.matches || []
    if (!matches || matches.length === 0) return null

    const songInfo = resp.data?.track || matches[0]
    return {
      title: songInfo.title || '未知歌曲',
      artist: songInfo.subtitle || '未知歌手',
      coverUrl: songInfo.images?.coverart || songInfo.images?.coverarthq || '',
    }
  } catch (err: any) {
    console.log('Shazam recognizeFromFile error:', err.message)
    return null
  }
}

/**
 * 录音并识别（需要 react-native-audio-recorder-player）
 * @param duration 录音时长（秒），默认5秒
 */
export const recognizeFromMic = async (duration: number = 5): Promise<{
  title: string
  artist: string
  coverUrl?: string
} | null> => {
  let recorder: any = null
  let RNFS: any = null
  let tempPath = ''

  try {
    // 1. 导入录制器
    let AudioRecorderPlayer: any
    try {
      AudioRecorderPlayer = await import('react-native-audio-recorder-player')
      AudioRecorderPlayer = AudioRecorderPlayer.default || AudioRecorderPlayer
    } catch {
      throw new Error('未安装音频录制库（react-native-audio-recorder-player）')
    }

    // 2. 导入 RNFS 获取缓存路径
    try {
      RNFS = await import('react-native-fs')
      RNFS = RNFS.default || RNFS
    } catch {
      RNFS = null
    }

    // 3. 确定录音文件路径
    if (RNFS?.CachesDirectoryPath) {
      tempPath = `${RNFS.CachesDirectoryPath}/shazam_recording.m4a`
    } else {
      // 备选路径
      tempPath = `${RNFS?.CachesDirectoryPath || '/data/data/com.lxnetease.music/cache'}/shazam_recording.m4a`
    }

    // 4. 创建录制器实例并开始录音
    recorder = new AudioRecorderPlayer()

    // 录音配置：麦克风输入 → AAC 编码 → MPEG_4 容器
    const audioSets = {
      AudioEncoderAndroid: 3,   // AAC
      AudioSourceAndroid: 1,    // MIC
      OutputFormatAndroid: 2,   // MPEG_4
    }

    await recorder.startRecorder(tempPath, audioSets, false)

    // 5. 等待录音时长
    await new Promise<void>(resolve => setTimeout(resolve, duration * 1000))

    // 6. 停止录音
    const recordedPath = await recorder.stopRecorder()

    // 7. 识别录音文件
    const result = await recognizeFromFile(recordedPath || tempPath)

    // 8. 清理临时文件
    if (RNFS?.unlink && (recordedPath || tempPath)) {
      try {
        await RNFS.unlink(recordedPath || tempPath)
      } catch { /* ignore cleanup error */ }
    }

    return result
  } catch (err: any) {
    console.log('Shazam recognizeFromMic error:', err.message)
    throw err // 让调用方处理错误信息展示
  }
}

/**
 * 检查是否可以录音识别
 */
export const canUseMicRecognition = async (): Promise<boolean> => {
  try {
    await import('react-native-audio-recorder-player')
    return true
  } catch {
    return false
  }
}
