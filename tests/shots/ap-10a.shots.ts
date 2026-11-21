// AP-10a: Settings, Cloud storage (Amazon S3). A made-up bucket and region saved through the
// section, and a made-up access key ID shown by its last four characters. Nothing is sent to S3.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

test('Settings, Cloud storage with a bucket and a key', async () => {
  session = await openApp()
  const { page } = session
  await screens.openSettings(page)
  const box = page.getByRole('region', { name: 'Cloud storage' })
  await box.getByLabel('Bucket', { exact: true }).fill('made-up-adman-pictures')
  await box.getByLabel('Region', { exact: true }).fill('eu-west-1')
  await box.getByLabel('Folder in the bucket').fill('approvals')
  await box.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(box.getByText('made-up-adman-pictures', { exact: true })).toBeVisible()

  const row = box.getByRole('group', { name: 'Amazon S3 Access key ID' })
  await row.getByRole('button', { name: 'Add' }).click()
  await row.getByLabel('New Amazon S3 Access key ID').fill('MADEUPKEYIDQ7RT')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText('Saved, ends in Q7RT')).toBeVisible()
  await box.scrollIntoViewIfNeeded()
  await shot(page, '90-settings-cloud-storage')
})
