// AP-10: Settings, the approvals service, against the stand-in on 127.0.0.1 (dev tools on, so
// the app accepts its plain http address). The address and a made-up key are saved through the
// section, then "Test connection" answers "Connected.". Only the key's last four are drawn.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../helpers/approvals-stand-in'
import { closeApp, openApp, shot, type Session } from './shot'

// Made up for this picture; the stand-in is told to accept it.
const KEY = 'made-up-approvals-shot-key-T4NB'

let session: Session | undefined
let stand: ApprovalsStandIn | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
    await stand?.close()
    stand = undefined
  }
})

test('Settings, Approvals service connected', async () => {
  stand = await startApprovalsStandIn({ key: KEY })
  session = await openApp({ ADMAN_DEV_TOOLS: '1' })
  const { page } = session
  await screens.openSettings(page)
  const box = page.getByRole('region', { name: 'Approvals service' })
  await box.getByLabel('Service address').fill(stand.origin)
  await box.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(box.getByRole('button', { name: 'Remove' })).toBeVisible()

  const row = box.getByRole('group', { name: 'Service API key' })
  await row.getByRole('button', { name: 'Add' }).click()
  await row.getByLabel('New Service API key').fill(KEY)
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText('Saved, ends in T4NB')).toBeVisible()

  await box.getByRole('button', { name: 'Test connection' }).click()
  await expect(box.getByRole('status')).toHaveText('Connected.')
  expect(stand.seen.map((s) => s.route)).toContain('health')
  await box.scrollIntoViewIfNeeded()
  await shot(page, '91-settings-approvals-service')
})
