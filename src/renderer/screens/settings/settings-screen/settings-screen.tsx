// Settings (FR-004, FR-067, FR-170, FR-191). Cloud storage: the S3 part (D-096); Dropbox in Phase 9.
// The approvals service follows Cloud storage (spec/approvals.md "Screens").
import { SetupSection } from '@/renderer/screens/settings/setup-section'
import { LocationSetting } from '@/renderer/screens/settings/location-setting'
import { ProviderDefaults } from '@/renderer/screens/settings/provider-defaults'
import { ExportSection } from '@/renderer/screens/settings/export-section'
import { KeysSection } from '@/renderer/screens/settings/keys-section'
import { S3Section } from '@/renderer/screens/settings/s3-section'
import { ApprovalsSection } from '@/renderer/screens/settings/approvals-section'
import { ComfySection } from '@/renderer/screens/settings/comfy-section'
import { McpSection } from '@/renderer/screens/settings/mcp-section'
import { AgentRunsSection } from '@/renderer/screens/settings/agent-runs-section'
import styles from './settings-screen.module.css'

export function SettingsScreen() {
  return (
    <section className={styles.screen} aria-labelledby="settings-title">
      <h1 id="settings-title">Settings</h1>
      <SetupSection />
      <LocationSetting />
      <ProviderDefaults />
      <ExportSection />
      <KeysSection />
      <S3Section />
      <ApprovalsSection />
      <ComfySection />
      <McpSection />
      <AgentRunsSection />
    </section>
  )
}
