// R2A-1 (R-10): a tile signed off at its current version, then the same tile after an edit,
// which shows "Changed since published" and no sign-off. Against the approvals stand-in on
// 127.0.0.1 and the test picture store (dev tools on); the reviewer is made up, at example.com.
// Nothing leaves this machine.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import * as steps from '../approvals-local/app-steps'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../helpers/approvals-stand-in'
import { closeApp, openApp, shot, type Session } from './shot'

// Made up for these pictures; the stand-in is told to accept the key.
const KEY = 'made-up-approvals-shot-key-R2A1'

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

// One sign-off on the first variant, at the version in the gallery.
function plantSignoff(on: ApprovalsStandIn) {
  const [pair, link] = [...on.links.entries()][0] ?? []
  const first = link?.gallery[0]
  if (pair === undefined || first === undefined) throw new Error('no gallery on the stand-in')
  const [projectId = '', campaignId = ''] = pair.split('/')
  on.plantSignoff(projectId, campaignId, {
    id: 'Rq2kPq7mZt2vWx9bLn3cRd8a',
    variantKey: first.variantKey,
    version: first.version,
    email: 'lena.marsh@example.com',
    signedAt: new Date().toISOString(),
  })
}

test('A tile signed off, then changed after the sign-off', async () => {
  test.setTimeout(180_000)
  stand = await startApprovalsStandIn({ key: KEY })
  session = await openApp({ ADMAN_DEV_TOOLS: '1', ADMAN_APPROVALS_TEST_PICTURES: stand.origin })
  const { app, page } = session
  await steps.setUpSettings(page, stand.origin, KEY)
  await screens.createProject(page, 'Spring Picnic Range')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)

  await steps.makeLink(page)
  plantSignoff(stand)
  await steps.refresh(page)
  const grid = steps.grid(page)
  await expect(grid.getByText('Signed off by 1')).toBeVisible()
  await grid.getByRole('button', { name: 'Sign-offs (1)' }).click()
  await expect(grid.getByText(/^lena\.marsh@example\.com · /)).toBeVisible()
  await shot(page, '90-r2-app-tile-signed')

  await steps.editVariant(page)
  await expect(grid.getByText('Changed since published')).toBeVisible()
  await expect(grid.getByRole('button', { name: /^Sign-offs/ })).toHaveCount(0)
  await shot(page, '90-r2-app-tile-changed')
})
