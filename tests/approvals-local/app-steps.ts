// The app's side of the approvals flow (spec/phases/approvals.md, exit criteria), shared by the
// offline spec (tests/e2e/approvals.spec.ts, the stand-in service) and the local proof
// (approvals-local.spec.ts, the real service). Elements are found by their accessible names.
// The bucket and S3 keys are made up: the test picture store is used, so nothing reaches S3.
import { expect, type Locator, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'

// Made up; a chosen link password of 12 characters or more, typed once and never shown.
export const LINK_PASSWORD = 'made-up link password 4QZ'
export const EDITED_TITLE = 'Harness Check, edited'

export const bar = (page: Page): Locator => page.getByRole('group', { name: 'Approval link' })
export const grid = (page: Page): Locator => page.getByRole('list', { name: 'Variants' })
export const dialog = (page: Page): Locator => page.getByRole('dialog', { name: 'Approval link' })

async function saveKey(page: Page, box: string, label: string, value: string) {
  const row = page.getByRole('region', { name: box }).getByRole('group', { name: label })
  await row.getByRole('button', { name: 'Add' }).click()
  await row.getByLabel(`New ${label}`).fill(value)
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText(/Saved, ends in/)).toBeVisible()
}

// Settings: a made-up bucket and keys, then the service's address and key and "Test connection".
export async function setUpSettings(page: Page, origin: string, key: string): Promise<void> {
  await screens.openSettings(page)
  const s3 = page.getByRole('region', { name: 'Cloud storage' })
  await s3.getByLabel('Bucket', { exact: true }).fill('made-up-adman-pictures')
  await s3.getByLabel('Region', { exact: true }).fill('eu-west-1')
  await s3.getByRole('button', { name: 'Save', exact: true }).click()
  await saveKey(page, 'Cloud storage', 'Amazon S3 Access key ID', 'MADEUPKEYIDQ7RT')
  await saveKey(page, 'Cloud storage', 'Amazon S3 Secret access key', 'made-up-secret-key-0001')
  const box = page.getByRole('region', { name: 'Approvals service' })
  await box.getByLabel('Service address').fill(origin)
  await box.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(box.getByRole('button', { name: 'Remove' })).toBeVisible()
  await saveKey(page, 'Approvals service', 'Service API key', key)
  await box.getByRole('button', { name: 'Test connection' }).click()
  await expect(box.getByRole('status')).toHaveText('Connected.', { timeout: 30_000 })
}

// A link with a chosen password, then the first gallery. Gives the link's address.
export async function makeLink(page: Page): Promise<string> {
  await bar(page).getByRole('button', { name: 'Approval link…' }).click()
  const box = dialog(page)
  await box.getByRole('radio', { name: 'Choose a password' }).check()
  await box.getByLabel('Password', { exact: true }).fill(LINK_PASSWORD)
  await box.getByRole('button', { name: 'Make link' }).click()
  await expect(box.getByText(/^Updated /)).toBeVisible({ timeout: 60_000 })
  const address = await box.getByRole('textbox', { name: 'Link' }).inputValue()
  await box.getByRole('button', { name: 'Close' }).click()
  return address
}

export async function refresh(page: Page): Promise<void> {
  const checked = bar(page).getByText(/^Checked /)
  const before = (await checked.count()) > 0 ? await checked.textContent() : null
  await bar(page).getByRole('button', { name: 'Refresh' }).click()
  await expect(bar(page).getByRole('button', { name: 'Refresh' })).toBeEnabled()
  if (before === null) await expect(checked).toBeVisible()
}

// A saved edit of the variant: its title, in the editor; then back to the overview.
export async function editVariant(page: Page): Promise<void> {
  await grid(page).getByRole('button').first().click()
  await page.getByRole('button', { name: 'Rename' }).click()
  await page.getByRole('textbox', { name: 'Variant title' }).fill(EDITED_TITLE)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: EDITED_TITLE })).toBeVisible()
  await page.getByRole('tab', { name: 'Overview' }).click()
}

// "Update gallery" in the dialog; the dialog stays open for the caller.
export async function updateGallery(page: Page): Promise<Locator> {
  await bar(page).getByRole('button', { name: 'Approval link…' }).click()
  const box = dialog(page)
  await expect(box.getByText('1 variant changed since.')).toBeVisible()
  await box.getByRole('button', { name: 'Update gallery' }).click()
  await expect(box.getByText('1 variant changed since.')).toBeHidden({ timeout: 60_000 })
  return box
}

export async function turnOffLink(page: Page): Promise<void> {
  await bar(page).getByRole('button', { name: 'Approval link…' }).click()
  const box = dialog(page)
  await box.getByRole('button', { name: 'Turn off link…' }).click()
  await box.getByRole('button', { name: 'Turn off link', exact: true }).click()
  await expect(box.getByText(/This link was turned off on /)).toBeVisible({ timeout: 30_000 })
  await box.getByRole('button', { name: 'Close' }).click()
  await expect(bar(page).getByText('Link turned off')).toBeVisible()
}
