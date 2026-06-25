import { memo } from 'react'

// import Section from '../../components/Section'
import Theme from './Theme'
import IsAutoTheme from './IsAutoTheme'
import IsHideBgDark from './IsHideBgDark'
import IsDynamicBg from './IsDynamicBg'
import IsFontShadow from './IsFontShadow'
import Blur from "@/screens/Home/Views/Setting/settings/Theme/Blur";
import CustomBg from "@/screens/Home/Views/Setting/settings/Theme/CustomBg";
import PicOpacity from "@/screens/Home/Views/Setting/settings/Theme/PicOpacity";
// import { useI18n } from '@/lang/i18n'

export default memo(() => {
  return (
    <>
      <Theme />
      <IsAutoTheme />
      <IsDynamicBg />
      <CustomBg />
      <PicOpacity />
      <Blur />
      <IsFontShadow />
    </>
  )
})
