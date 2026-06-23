/**
 * 音乐助手入口按钮
 * 点击后跳转到音乐助手页面
 */
import { memo } from 'react'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import { initAiService } from '@/core/ai'

export const openMusicAssistant = () => {
  void initAiService()
  setNavActiveId('nav_music_assistant')
}

interface AIButtonProps {
  style?: any
}

export const AIButton = memo(({ style }: AIButtonProps) => {
  const theme = useTheme()
  return (
    <Button
      onPress={openMusicAssistant}
      style={[
        styles.button,
        { backgroundColor: theme['c-button-background'] },
        style,
      ]}
    >
      <Text size={13} color={theme['c-button-font']}>
        助手
      </Text>
    </Button>
  )
})

const styles = createStyle({
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    marginLeft: 8,
  },
})

export default AIButton
