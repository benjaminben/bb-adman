// Settings (FR-004, FR-067, FR-170). Cloud storage (Phase 9) and agent access
// (Phase 10) add their sections here.
import { LocationSetting } from './location-setting'
import { ProviderDefaults } from './provider-defaults'
import { KeysSection } from './keys-section'
import styles from '../screens.module.css'

export function SettingsScreen() {
  return (
    <section className={styles.screen} aria-labelledby="settings-title">
      <h1 id="settings-title">Settings</h1>
      <LocationSetting />
      <ProviderDefaults />
      <KeysSection />
    </section>
  )
}
