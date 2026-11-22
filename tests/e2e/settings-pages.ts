// Settings is a side list of four pages (SET-1): "AI services", "Files", "Publish", "Agents".
// Re-exported from screens.ts, which is at its line limit. Not a test file itself.
import type { Page } from '@playwright/test'

// Opens Settings on the side list's page `label`. The Settings button toggles (SH-2), so it is
// pressed only when Settings is not showing already.
export async function openSettingsPage(page: Page, label: string): Promise<void> {
  const button = page.getByRole('button', { name: 'Settings', exact: true })
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click()
  await chooseSettingsPage(page, label)
}

// Moves to another Settings page while Settings shows.
export async function chooseSettingsPage(page: Page, label: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Settings pages' })
    .getByRole('button', { name: label, exact: true })
    .click()
}
