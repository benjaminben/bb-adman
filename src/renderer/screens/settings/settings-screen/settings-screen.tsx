// Settings (FR-004, FR-067, FR-170, FR-191). Cloud storage (Phase 9) adds its section here.
import { LocationSetting } from '@/renderer/screens/settings/location-setting'
import { ProviderDefaults } from '@/renderer/screens/settings/provider-defaults'
import { KeysSection } from '@/renderer/screens/settings/keys-section'
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
      <ComfySection />
      <McpSection />
      <AgentRunsSection />
    </section>
  )
}
