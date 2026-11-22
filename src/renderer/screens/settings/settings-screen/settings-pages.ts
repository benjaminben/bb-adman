// The four Settings pages (SET-1, choice C-1) and the page chosen last. The choice lasts for
// the window's life only, like the Section fold memory (C-8); nothing is saved.
import type { IconName } from '@/renderer/ui/icon'

export type SettingsPage = 'ai' | 'files' | 'publish' | 'agents'

export const SETTINGS_PAGES: { id: SettingsPage; label: string; icon: IconName }[] = [
  { id: 'ai', label: 'AI services', icon: 'sparkle' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'publish', label: 'Publish', icon: 'cloud' },
  { id: 'agents', label: 'Agents', icon: 'bot' },
]

let chosen: SettingsPage = 'ai'

export function rememberedPage(): SettingsPage {
  return chosen
}

export function rememberPage(page: SettingsPage): void {
  chosen = page
}
