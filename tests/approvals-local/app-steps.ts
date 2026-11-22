// The app's side of the approvals flow (spec/phases/approvals.md, exit criteria), shared by the
// offline spec (tests/e2e/approvals.spec.ts, the stand-in service) and the local proof
// (approvals-local.spec.ts, the real service). Elements are found by their accessible names.
// The bucket and S3 keys are made up: the test picture store is used, so nothing reaches S3.
import { expect, type Locator, type Page } from '@playwright/test'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'

// Made up; a chosen link password of 12 characters or more, typed once and never shown.
export const LINK_PASSWORD = 'made-up link password 4QZ'
export const EDITED_TITLE = 'Harness Check, edited'

export const bar = (page: Page): Locator => page.getByRole('group', { name: 'Approval link' })
export const grid = (page: Page): Locator => page.getByRole('list', { name: 'Variants' })
export const dialog = (page: Page): Locator => page.getByRole('dialog', { name: 'Approval link' })

async function saveKey(page: Page, box: string, label: string, value: string) {
  const row = page.getByRole('region', { name: box }).getByRole('group', { name: label })
  await row.getByRole('button', { name: 'Add key' }).click()
  await row.getByLabel(`New ${label}`).fill(value)
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText(/^•••/)).toBeVisible()
}

// A Publish page service row's form shows only while the row is open (SET-4).
async function openRow(box: Locator, name: string) {
  const row = box.getByRole('button', { name, exact: true, expanded: false })
  if ((await row.count()) > 0) await row.click()
}

// Settings: a made-up bucket and keys, then the service's address and key and "Test connection".
export async function setUpSettings(page: Page, origin: string, key: string): Promise<void> {
  await screens.openSettingsPage(page, 'Publish')
  const s3 = page.getByRole('region', { name: 'Cloud storage' })
  await openRow(s3, 'Amazon S3')
  await s3.getByLabel('Bucket', { exact: true }).fill('made-up-adman-pictures')
  await s3.getByLabel('Region', { exact: true }).fill('eu-west-1')
  await s3.getByRole('button', { name: 'Save', exact: true }).click()
  await saveKey(page, 'Cloud storage', 'Amazon S3 Access key ID', 'MADEUPKEYIDQ7RT')
  await saveKey(page, 'Cloud storage', 'Amazon S3 Secret access key', 'made-up-secret-key-0001')
  const box = page.getByRole('region', { name: 'Approvals service' })
  await openRow(box, 'Approvals')
  await box.getByLabel('Service address').fill(origin)
  await box.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(box.getByRole('button', { name: 'Remove' })).toBeVisible()
  await saveKey(page, 'Approvals service', 'Service API key', key)
  await box.getByRole('button', { name: 'Test connection' }).click()
  // The row's mark reads "Connected"; its tip, "Connected.", is in the same status region.
  await expect(box.getByRole('status')).toContainText('Connected.', { timeout: 30_000 })
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
  await grid(page).getByRole('button').first().dblclick()
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

// The project closed from the campaign view, so its file can be changed on disk.
export async function closeProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Back to project' }).click()
  const close = page.getByRole('button', { name: `Close ${name}` })
  await close.click()
  await expect(close).toHaveCount(0)
}

export async function reopenProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^Open ${name}`) }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await screens.openCampaign(page)
}

// The brief's variant becomes a video post of the given length, in the closed project file.
export function plantVideo(filePath: string, variantId: string, ms: number): void {
  const db = new Database(filePath)
  try {
    db.prepare("UPDATE variant SET format = 'video', duration_ms = ? WHERE id = ?").run(
      ms,
      variantId,
    )
  } finally {
    db.close()
  }
}

// The app's data folder as global-setup.ts left it: first-run setup marked done, the test
// picture folder kept (the picture server serves it), everything an earlier case saved removed.
export function freshUserData(folder: string): void {
  const userData = path.join(folder, 'userData')
  for (const name of fs.readdirSync(userData)) {
    if (name !== 'approvals-test-pictures') {
      fs.rmSync(path.join(userData, name), { recursive: true, force: true })
    }
  }
  const defaults = { defaultProjectDir: path.join(folder, 'projects'), setup: { done: true } }
  fs.writeFileSync(path.join(userData, 'settings.json'), JSON.stringify(defaults))
}

// The clip files in a campaign's test picture folder.
export function clipsIn(userData: string, ids: { projectId: string; campaignId: string }) {
  const at = path.join(userData, 'approvals-test-pictures', 'adman-approvals')
  const names = fs.readdirSync(path.join(at, ids.projectId, ids.campaignId))
  return names.filter((name) => name.endsWith('.mp4'))
}
