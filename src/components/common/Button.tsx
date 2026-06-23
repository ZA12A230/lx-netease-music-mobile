import { useTheme } from '@/store/theme/hook'
import { useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import { Pressable, type PressableProps, StyleSheet, type View, type ViewProps } from 'react-native'
import { createStyle } from '@/utils/tools'
// import { AppColors } from '@/theme'

export interface BtnProps extends PressableProps {
  ripple?: PressableProps['android_ripple']
  style?: ViewProps['style']
  onChangeText?: (value: string) => void
  onClearText?: () => void
  children: React.ReactNode
  glass?: boolean
}

export interface BtnType {
  measure: (
    callback: (
      x: number,
      y: number,
      width: number,
      height: number,
      pageX: number,
      pageY: number
    ) => void
  ) => void
}

const glassStyles = createStyle({
  glass: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
})

export default forwardRef<BtnType, BtnProps>(
  ({ ripple: propsRipple = {}, disabled, children, style, glass, ...props }, ref) => {
    const theme = useTheme()
    const btnRef = useRef<View>(null)
    const ripple = useMemo(
      () => ({
        color: theme['c-primary-light-200-alpha-700'],
        ...propsRipple,
      }),
      [theme, propsRipple]
    )

    useImperativeHandle(ref, () => ({
      measure(callback) {
        btnRef.current?.measure(callback)
      },
    }))

    return (
      <Pressable
        android_ripple={ripple}
        disabled={disabled}
        style={
          glass
            ? StyleSheet.compose(
                StyleSheet.compose({ opacity: disabled ? 0.3 : 1 }, glassStyles.glass),
                style
              )
            : StyleSheet.compose({ opacity: disabled ? 0.3 : 1 }, style)
        }
        {...props}
        ref={btnRef}
      >
        {children}
      </Pressable>
    )
  }
)
