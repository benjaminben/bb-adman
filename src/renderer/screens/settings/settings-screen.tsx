// Settings (FR-004, FR-067, FR-170, FR-191). Cloud storage (Phase 9) adds its section here.
import { LocationSetting } from './location-setting'
import { ProviderDefaults } from './provider-defaults'
import { KeysSection } from './keys-section'
import { ComfySection } from './comfy-section'
import { McpSection } from './mcp-section'
import styles from '../screens.module.css'

export function SettingsScreen() {
  return (
    <section className={styles.screen} aria-labelledby="settings-title">
      <h1 id="settings-title">Settings</h1>
      <LocationSetting />
      <ProviderDefaults />
      <KeysSection />
      <ComfySection />
      <McpSection />
    </section>
  )
}
