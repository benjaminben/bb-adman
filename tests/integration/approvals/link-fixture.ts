// Test helper for the AP-8 link commands and queries: a core with dev tools on, a project with
// two campaigns, the approvals stand-in, and the test picture store over a temporary folder
// the stand-in serves. Nothing leaves this machine. Not a test file itself.
import type Database from 'better-sqlite3'
import { vi } from 'vitest'
import { AppError } from '@/shared/schemas/result'
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

// AP-9 helpers: the variants of a campaign, more of them, and a stand-in draw.
export type VariantFacts = { id: string; rev: number; title: string }

export function variantsOf(lf: LinkFixture, campaignId = lf.c1): VariantFacts[] {
  return lf
    .db()
    .prepare(
      `SELECT v.id, v.rev, v.title FROM variant v JOIN direction d ON v.direction_id = d.id
       WHERE d.campaign_id = ?
       ORDER BY d.sort, v.id = d.master_variant_id DESC, v.created_at, v.id`,
    )
    .all(campaignId) as VariantFacts[]
}

const KEY_LETTERS = '23456789abcdefghjkmnpqrstuvwxyz'
const keyFor = (i: number) =>
  'zz' + [29791, 961, 31, 1].map((d) => KEY_LETTERS.charAt(Math.floor(i / d) % 31)).join('')

// n copies of the campaign's first variant in its direction, each made later than the last,
// with its ID as its size label (one variant per size, language and format).
// `from` keeps the IDs of two calls apart.
export function addVariants(lf: LinkFixture, campaignId: string, n: number, from = 0): string[] {
  const db = lf.db()
  const first = variantsOf(lf, campaignId)[0]
  if (!first) throw new Error('The campaign has no variant')
  const cols = (db.prepare('PRAGMA table_info(variant)').all() as Array<{ name: string }>)
    .map((c) => c.name)
    .filter((c) => !['id', 'created_at', 'size_label'].includes(c))
  const copy = db.prepare(
    `INSERT INTO variant (id, created_at, size_label, ${cols.join(', ')})
     SELECT ?, ?, ?, ${cols.join(', ')} FROM variant WHERE id = ?`,
  )
  const ids: string[] = []
  for (let i = from; i < from + n; i++) {
    const at = new Date(Date.UTC(2099, 0, 1) + i).toISOString()
    copy.run(keyFor(i), at, keyFor(i), first.id)
    ids.push(keyFor(i))
  }
  return ids
}

export const bumpRev = (lf: LinkFixture, variantId: string) =>
  lf.db().prepare('UPDATE variant SET rev = rev + 1 WHERE id = ?').run(variantId)

// deps.render.render answers a small PNG and the variant's rev now; `fail` names a variant
// whose draw throws as the render service does.
export function stubDraw(lf: LinkFixture, fail?: string) {
  return vi.spyOn(lf.f.core.deps.render, 'render').mockImplementation(async (_p, variantId) => {
    if (variantId === fail) {
      throw new AppError('RULE_VIOLATION', 'A picture could not be drawn.', {
        reason: 'render_failed',
      })
    }
    const row = lf.db().prepare('SELECT rev FROM variant WHERE id = ?').get(variantId) as {
      rev: number
    }
    return { png: new Uint8Array([137, 80, 78, 71, row.rev]), width: 8, height: 8, rev: row.rev }
  })
}
