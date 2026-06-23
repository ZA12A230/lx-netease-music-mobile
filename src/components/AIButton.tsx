/**
 * AI 助手入口按钮
 * 点击后打开 AI 助手页面
 */
import { memo } from 'react'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { AI_ASSISTANT_SCREEN } from '@/navigation/screenNames'
import { initAiService } from '@/core/ai'

export const openAIAssistant = () => {
  // 确保 AI 服务已初始化
  void initAiService()
  Navigation.showModal({
    stack: {
      children: [
        {
          component: {
            name: AI_ASSISTANT_SCREEN,
            options: {
              topBar: { visible: false },
              statusBar: { visible: false },
            },
          },
        },
      ],
    },
  })
}

interface AIButtonProps {
  style?: any
}

export const AIButton = memo(({ style }: AIButtonProps) => {
  const theme = useTheme()
  return (
    <Button
      onPress={openAIAssistant}
      style={[
        styles.button,
        { backgroundColor: theme['c-button-background'] },
        style,
      ]}
    >
      <Text size={13} color={theme['c-button-font']}>
        AI
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
