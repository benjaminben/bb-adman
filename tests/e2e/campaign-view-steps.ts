// R2C-1 (spec/phases/round-2-campaign.md, design addition 1): the campaign overview shows one
// view at a time, "Variants", "Checks" or "Translations". Steps that reach a view's panels show
// it first, as the user does. The Checks tab's name may end in its warning badge, so the name
// is matched from its start. Not a test file itself.
import { expect, type Page } from '@playwright/test'

export type CampaignViewTab = 'Variants' | 'Checks' | 'Translations'

export async function showCampaignView(page: Page, name: CampaignViewTab): Promise<void> {
  const views = page.getByRole('tablist', { name: 'Campaign' })
  const tab = views.getByRole('tab', { name: new RegExp(`^${name}( |$)`) })
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
}
