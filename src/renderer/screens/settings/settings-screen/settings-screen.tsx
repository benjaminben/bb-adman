// Settings (FR-004, FR-067, FR-170, FR-191): a side list of four pages (SET-1, choice C-1), each
// a title and its parts. Cloud storage holds the S3 part (D-096) and Dropbox; the approvals
// service follows it (spec/approvals.md "Screens"). The Setup button sits at the list's foot.
// Given onClose, the screen has a way out (SH-2, choice C-14): the "Close settings" icon button
// at its top right, and Escape (ui/escape-leave).
import { useState, type ReactNode } from 'react'
import { SetupButton } from '@/renderer/screens/settings/setup-section'
import { LocationSetting } from '@/renderer/screens/settings/location-setting'
import { ProviderDefaults } from '@/renderer/screens/settings/provider-defaults'
import { ExportSection } from '@/renderer/screens/settings/export-section'
import { KeysSection } from '@/renderer/screens/settings/keys-section'
import { S3Section } from '@/renderer/screens/settings/s3-section'
import { ApprovalsSection } from '@/renderer/screens/settings/approvals-section'
import { ComfySection } from '@/renderer/screens/settings/comfy-section'
import { McpSection } from '@/renderer/screens/settings/mcp-section'
import { AgentRunsSection } from '@/renderer/screens/settings/agent-runs-section'
import { SideList } from '@/renderer/ui/side-list'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { SETTINGS_PAGES, rememberPage, rememberedPage, type SettingsPage } from './settings-pages'
import { useEscapeLeave } from '@/renderer/ui/escape-leave'
import styles from './settings-screen.module.css'

const PARTS: Record<SettingsPage, () => ReactNode> = {
  ai: () => (
    <>
      <KeysSection />
      <ComfySection />
      <ProviderDefaults />
    </>
  ),
  files: () => (
    <>
      <LocationSetting />
      <ExportSection />
    </>
  ),
  publish: () => (
    <>
      <S3Section />
      <ApprovalsSection />
    </>
  ),
  agents: () => (
    <>
      <McpSection />
      <AgentRunsSection />
    </>
  ),
}

export function SettingsScreen(props: { page?: SettingsPage; onClose?: () => void }) {
  useEscapeLeave(props.onClose)
  const [current, setCurrent] = useState<SettingsPage>(() => props.page ?? rememberedPage())
  const choose = (id: string) => {
    const page = SETTINGS_PAGES.find((p) => p.id === id)
    if (page === undefined) return
    rememberPage(page.id)
    setCurrent(page.id)
  }
  const title = SETTINGS_PAGES.find((p) => p.id === current)?.label
  return (
    <section className={styles.screen} aria-labelledby="settings-title">
      <div className={styles.side}>
        <h1 id="settings-title">Settings</h1>
        <SideList
          label="Settings pages"
          items={SETTINGS_PAGES}
          current={current}
          onChoose={choose}
          foot={<SetupButton />}
        />
      </div>
      <section className={styles.page} aria-labelledby="settings-page-title">
        <h2 id="settings-page-title" className={styles.title}>
          {title}
        </h2>
        {PARTS[current]()}
      </section>
      {props.onClose && (
        <button
          type="button"
          className={`${layout.iconButton} ${styles.close}`}
          aria-label="Close settings"
          title="Close settings"
          onClick={props.onClose}
        >
          <Icon name="x" />
        </button>
      )}
    </section>
  )
}
