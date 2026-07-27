// @ts-nocheck
import RNFS from 'react-native-fs'
import { addUserApi, getUserApiList } from '@/utils/data'
import { setUserApiList, importUserApi } from '@/core/userApi'
import { bootLog } from '@/utils/bootLog'
import { getData, saveData } from '@/plugins/storage'

// 内置音源文件列表（位于 android/app/src/main/assets/musicSources/）
const BUILTIN_SOURCES = [
  'musicSources/yecao.js',
  'musicSources/sixyin-music-source-v1.1.0.js',
  'musicSources/小熊猫v1.1.1.js',
  'musicSources/梓澄音源_v1.2.3.4.5.js',
  'musicSources/Huibq音源_v1.2.0.js',
]

// 标记内置音源是否已导入的存储键
const BUILTIN_IMPORTED_KEY = '@builtin_sources_imported_v1'

/**
 * 从 android assets 读取内置音源脚本并导入
 * 仅在用户没有任何音源时自动导入
 */
export const importBuiltinSources = async (): Promise<boolean> => {
  try {
    const existingList = await getUserApiList()
    // 如果用户已有音源，不自动导入
    if (existingList.length > 0) {
      bootLog('User already has sources, skip builtin import.')
      return false
    }

    // 检查是否已经导入过内置音源（避免重复导入）
    const imported = await getData<boolean>(BUILTIN_IMPORTED_KEY)
    if (imported) {
      bootLog('Builtin sources already imported before.')
      return false
    }

    bootLog('Start importing builtin sources...')
    let successCount = 0
    for (const assetPath of BUILTIN_SOURCES) {
      try {
        const script = await RNFS.readFileAssets(assetPath, 'utf8')
        if (!script || script.length < 50) {
          bootLog(`Skip empty source: ${assetPath}`)
          continue
        }
        await importUserApi(script)
        successCount++
        bootLog(`Imported builtin source: ${assetPath}`)
      } catch (err: any) {
        bootLog(`Failed to import ${assetPath}: ${err.message}`)
      }
    }

    if (successCount > 0) {
      await saveData(BUILTIN_IMPORTED_KEY, true)
      // 刷新音源列表
      const newList = await getUserApiList()
      setUserApiList(newList)
      bootLog(`Builtin sources imported: ${successCount}`)
      return true
    }
    return false
  } catch (err: any) {
    bootLog(`Import builtin sources failed: ${err.message}`)
    return false
  }
}

/**
 * 获取内置音源文件列表（供设置页面使用）
 */
export const getBuiltinSourceList = () => {
  return BUILTIN_SOURCES.map((path) => {
    const fileName = path.split('/').pop() || path
    return { path, fileName }
  })
}
