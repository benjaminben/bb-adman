// Settings (FR-004, FR-067, FR-170, FR-191). Cloud storage: the S3 part (D-096); Dropbox in Phase 9.
import { LocationSetting } from '@/renderer/screens/settings/location-setting'
import { ProviderDefaults } from '@/renderer/screens/settings/provider-defaults'
import { KeysSection } from '@/renderer/screens/settings/keys-section'
import { S3Section } from '@/renderer/screens/settings/s3-section'
import { ComfySection } from '@/renderer/screens/settings/comfy-section'
import { McpSection } from '@/renderer/screens/settings/mcp-section'
import { AgentRunsSection } from '@/renderer/screens/settings/agent-runs-section'
import layout from '@/renderer/ui/layout.module.css'

export function SettingsScreen() {
  return (
    <section className={layout.screen} aria-labelledby="settings-title">
      <h1 id="settings-title">Settings</h1>
      <LocationSetting />
      <ProviderDefaults />
      <KeysSection />
      <S3Section />
      <ComfySection />
      <McpSection />
      <AgentRunsSection />
    </section>
  )
}
