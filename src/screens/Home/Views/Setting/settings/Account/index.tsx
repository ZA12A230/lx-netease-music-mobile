import { memo } from 'react'
import { ScrollView } from 'react-native'
import Section from '../../components/Section'
import PlatformLogin from './PlatformLogin'
import { useI18n } from '@/lang'

const PLATFORMS = ['wy', 'tx', 'kg', 'kw', 'mg']

export default memo(() => {
  const t = useI18n()

  return (
    <ScrollView keyboardShouldPersistTaps="always">
      <Section title={t('setting_account')}>
        {PLATFORMS.map(id => (
          <PlatformLogin key={id} platformId={id} />
        ))}
      </Section>
    </ScrollView>
  )
})