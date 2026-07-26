import { forwardRef, useImperativeHandle, useState, useCallback, useRef } from 'react'
import { View, StyleSheet, TouchableOpacity, Image, TextInput } from 'react-native'
import Modal, { type ModalType } from '@/components/common/Modal'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { toast } from '@/utils/tools'
import { generateShareCode, parseShareCode, generateQRDataUrl } from '@/utils/shareCode'
import Clipboard from '@react-native-clipboard/clipboard'

export interface ShareCodeModalType {
  show: (playlist: {
    name: string
    songs: Array<{
      name: string
      singer: string
      source: string
      songId: string | number
    }>
  }) => void
}

const Header = ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()

  return (
    <View style={[styles.header, { height: 50 + statusBarHeight, paddingTop: statusBarHeight, backgroundColor: theme['c-content-background'] }]}>
      <TouchableOpacity onPress={onClose} style={styles.backButton}>
        <Icon name="chevron-left" size={24} color={theme['c-font']} />
      </TouchableOpacity>
      <Text size={18}>分享歌单</Text>
      <View style={styles.backButton} />
    </View>
  )
}

export default forwardRef<ShareCodeModalType, {}>((props, ref) => {
  const modalRef = useRef<ModalType>(null)
  const theme = useTheme()
  const [shareCode, setShareCode] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [playlistName, setPlaylistName] = useState('')
  const [importCode, setImportCode] = useState('')
  const [mode, setMode] = useState<'share' | 'import'>('share')

  useImperativeHandle(ref, () => ({
    show(playlist) {
      setPlaylistName(playlist.name)
      const code = generateShareCode(playlist)
      setShareCode(code)
      setQrUrl(generateQRDataUrl(code))
      setMode('share')
      modalRef.current?.setVisible(true)
    },
  }))

  const handleClose = useCallback(() => {
    modalRef.current?.setVisible(false)
  }, [])

  const handleCopyCode = useCallback(() => {
    Clipboard.setString(shareCode)
    toast('分享码已复制到剪贴板')
  }, [shareCode])

  const handleImport = useCallback(() => {
    if (!importCode.trim()) {
      toast('请输入分享码')
      return
    }
    const parsed = parseShareCode(importCode.trim())
    if (!parsed) {
      toast('分享码无效，请检查后重试')
      return
    }
    global.app_event.emit('importShareCode', parsed)
    toast(`正在导入歌单「${parsed.name}」，共 ${parsed.songs.length} 首歌曲`)
    handleClose()
  }, [importCode])

  return (
    <Modal ref={modalRef} onHide={() => {}} statusBarPadding={false} bgHide={false}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <Header onClose={handleClose} />

        <View style={styles.content}>
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'share' && { backgroundColor: theme['c-primary-background-active'] }]}
              onPress={() => setMode('share')}
            >
              <Text color={mode === 'share' ? theme['c-primary-font'] : theme['c-font']}>分享</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'import' && { backgroundColor: theme['c-primary-background-active'] }]}
              onPress={() => setMode('import')}
            >
              <Text color={mode === 'import' ? theme['c-primary-font'] : theme['c-font']}>导入</Text>
            </TouchableOpacity>
          </View>

          {mode === 'share' ? (
            <View style={styles.shareSection}>
              <Text size={16} style={styles.title}>分享「{playlistName}」</Text>
              {qrUrl ? (
                <Image source={{ uri: qrUrl }} style={styles.qrCode} resizeMode="contain" />
              ) : null}
              <View style={styles.codeBox}>
                <Text size={12} color={theme['c-font-label']} style={styles.codeText} numberOfLines={3}>
                  {shareCode}
                </Text>
              </View>
              <TouchableOpacity style={[styles.copyBtn, { backgroundColor: theme['c-button-background'] }]} onPress={handleCopyCode}>
                <Text color={theme['c-button-font']} size={14}>复制分享码</Text>
              </TouchableOpacity>
              <Text size={11} color={theme['c-500']} style={styles.tip}>
                将分享码发送给好友，对方即可通过「导入」功能恢复歌单
              </Text>
            </View>
          ) : (
            <View style={styles.importSection}>
              <Text size={16} style={styles.title}>导入歌单</Text>
              <TextInput
                style={[styles.input, { color: theme['c-font'], backgroundColor: theme['c-primary-input-background'] }]}
                placeholder="粘贴分享码..."
                placeholderTextColor={theme['c-font-label']}
                value={importCode}
                onChangeText={setImportCode}
                multiline
                numberOfLines={4}
              />
              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: theme['c-button-background'] }]}
                onPress={handleImport}
              >
                <Text color={theme['c-button-font']} size={14}>导入歌单</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  modeSwitch: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  shareSection: {
    alignItems: 'center',
  },
  importSection: {
    alignItems: 'center',
  },
  title: {
    marginBottom: 15,
    textAlign: 'center',
  },
  qrCode: {
    width: 200,
    height: 200,
    marginBottom: 15,
    borderRadius: 8,
  },
  codeBox: {
    width: '100%',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    marginBottom: 15,
  },
  codeText: {
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  copyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 10,
  },
  tip: {
    textAlign: 'center',
    marginTop: 5,
  },
  input: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    textAlignVertical: 'top',
    fontSize: 13,
  },
})