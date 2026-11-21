// Test helper for the AP-8 link commands and queries: a core with dev tools on, a project with
// two campaigns, the approvals stand-in, and the test picture store over a temporary folder
// the stand-in serves. Nothing leaves this machine. Not a test file itself.
import type Database from 'better-sqlite3'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../../helpers/approvals-stand-in'

export const KEY = 'made-up-approvals-key-for-the-link-tests-0008'

export type LinkFixture = {
  f: Fixture
  stand: ApprovalsStandIn
  projectId: string
  // Two campaigns of the project; the second proves the first's work stays in its own place.
  c1: string
  c2: string
  db: () => Database.Database
  close: () => Promise<void>
}

export async function campaignIn(f: Fixture, projectId: string, name: string, fresh: boolean) {
  const input = createInput()
  const subjectMap = input.subjectMap.map((m) => ({ ...m, create: fresh }))
  const made = await f.user('campaign.create', {
    projectId,
    ...input,
    subjectMap,
    brief: { ...input.brief, campaignName: name },
  })
  return data<{ campaignId: string }>(made).campaignId
}

export async function makeLinkFixture(): Promise<LinkFixture> {
  const stand = await startApprovalsStandIn({ key: KEY })
  const f = makeFixture({ env: { ADMAN_APPROVALS_TEST_PICTURES: stand.origin } })
  Object.assign(f.core.deps, { devTools: true })
  const projectId = data<{ projectId: string }>(
    await f.user('project.create', { name: 'Links', location: f.projectsDir }),
  ).projectId
  const c1 = await campaignIn(f, projectId, 'Spring Sale', true)
  const c2 = await campaignIn(f, projectId, 'Autumn Sale', false)
  return {
    f,
    stand,
    projectId,
    c1,
    c2,
    db: () => f.core.projects.requireOpen(projectId).db,
    close: async () => {
      f.cleanup()
      await stand.close()
    },
  }
}

export type SetUpParts = { service?: boolean; bucket?: boolean; s3Keys?: boolean }

// Each part of the setup the shared refusals look at; all of them unless one is turned off.
export async function setUp(lf: LinkFixture, parts: SetUpParts = {}): Promise<void> {
  const { f, stand } = lf
  if (parts.service !== false) {
    await f.user('approvals.setService', { address: stand.origin })
    await f.user('secret.set', { name: 'approvals.apiKey', value: KEY })
  }
  if (parts.bucket !== false) {
    f.core.settings.update({
      storage: { s3: { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' } },
    })
  }
  if (parts.s3Keys !== false) {
    await f.user('secret.set', { name: 's3.accessKeyId', value: 'made-up-access-key-id' })
    await f.user('secret.set', { name: 's3.secretAccessKey', value: 'made-up-secret-key' })
  }
}

export const pair = (lf: LinkFixture, campaignId = lf.c1) => ({
  projectId: lf.projectId,
  campaignId,
})
