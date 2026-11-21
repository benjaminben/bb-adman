// approvals.forCampaign and approvals.getPassword (spec/approvals.md "Queries and the event"):
// the ready value, the link with its address, passwordKept, every variant in campaign.get
// order with its sign-offs, and rows from a hostile project file skipped and logged without
// their values. Both are user only.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { APPROVALS_QUERY_DENIED } from '@/shared/approvals/messages'
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import { data } from '../core-fixture'
import { makeLinkFixture, pair, setUp, type LinkFixture, type SetUpParts } from './link-fixture'

const PASSWORD = 'the-link-password-00001'
const asUser = { actor: 'user' as const }
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
})
afterEach(() => lf.close())

const forCampaign = async (campaignId = lf.c1) =>
  data<ApprovalsForCampaign>(
    await lf.f.core.query('approvals.forCampaign', pair(lf, campaignId), asUser),
  )
const getPassword = async () =>
  data<{ password: string | null }>(
    await lf.f.core.query('approvals.getPassword', pair(lf), asUser),
  )

async function withLink(): Promise<string> {
  await setUp(lf)
  const made = await lf.f.user('approvals.createLink', { ...pair(lf), password: PASSWORD })
  return data<{ slug: string }>(made).slug
}

function plantSignoff(id: string, variantId: string, version: number, email: string) {
  lf.db()
    .prepare(
      `INSERT INTO approval_signoff (id, campaign_id, variant_id, version, email, signed_at)
       VALUES (?, ?, ?, ?, ?, '2026-11-02T10:00:00.000Z')`,
    )
    .run(id, lf.c1, variantId, version, email)
}

describe('approvals.forCampaign [spec/approvals.md "Queries and the event"]', () => {
  it.each([
    ['no_service', { service: false }],
    ['no_service', { service: false, bucket: false, s3Keys: false }],
    ['no_bucket', { bucket: false }],
    ['no_bucket', { s3Keys: false }],
    ['ready', {}],
  ] as Array<[string, SetUpParts]>)('answers %s for %j', async (ready, parts) => {
    await setUp(lf, parts)
    expect((await forCampaign()).ready).toBe(ready)
  })

  it('has no link before one is made', async () => {
    await setUp(lf)
    expect((await forCampaign()).link).toBeNull()
  })

  it('gives the link with its address and passwordKept', async () => {
    const slug = await withLink()
    const { link } = await forCampaign()
    expect(link).toEqual({
      state: 'live',
      address: `${lf.stand.origin}/l/${slug}`,
      createdAt: expect.any(String),
      publishedAt: null,
      checkedAt: null,
      endedAt: null,
      passwordKept: true,
    })
    expect((await forCampaign(lf.c2)).link).toBeNull()
  })

  it('gives no address when no address is set, and passwordKept false on another computer', async () => {
    await withLink()
    data(await lf.f.user('approvals.setService', { address: null }))
    lf.f.core.deps.approvals.passwords.forget(lf.projectId, lf.c1)
    const result = await forCampaign()
    expect(result.ready).toBe('no_service')
    expect(result.link).toMatchObject({ address: null, passwordKept: false, state: 'live' })
  })

  it('lists every variant of the campaign in campaign.get order, with its rev', async () => {
    await setUp(lf)
    const got = data<CampaignGet>(await lf.f.core.query('campaign.get', pair(lf), asUser)).variants
    const answer = (await forCampaign()).variants
    expect(answer.map((v) => v.variantId)).toEqual(got.map((v) => v.id))
    expect(answer.map((v) => v.currentRev)).toEqual(got.map((v) => v.rev))
    expect(answer.every((v) => v.publishedRev === null && v.signoffs.length === 0)).toBe(true)
  })

  it('marks a sign-off current when its version equals the published rev', async () => {
    await withLink()
    const [first = ''] = (await forCampaign()).variants.map((v) => v.variantId)
    lf.db()
      .prepare(
        `INSERT INTO approval_variant (campaign_id, variant_id, published_rev, expires_at)
         VALUES (?, ?, 3, '2026-11-09T10:00:00.000Z')`,
      )
      .run(lf.c1, first)
    plantSignoff('A'.repeat(24), first, 3, 'pat@client.example.com')
    plantSignoff('B'.repeat(24), first, 2, 'sam@client.example.com')
    const v = (await forCampaign()).variants.find((x) => x.variantId === first)
    expect(v?.publishedRev).toBe(3)
    expect(v?.signoffs).toEqual([
      expect.objectContaining({ id: 'A'.repeat(24), version: 3, current: true }),
      expect.objectContaining({ id: 'B'.repeat(24), version: 2, current: false }),
    ])
  })

  it.each([
    ['a slug with script in it', "javascript:alert('x')"],
    ['a slug that leaves the path', '../../x/evil'],
  ])(
    'skips a link row with %s, logs it without the value, and builds no address',
    async (_n, bad) => {
      await withLink()
      lf.db().prepare('UPDATE approval_link SET slug = ? WHERE campaign_id = ?').run(bad, lf.c1)
      const result = await forCampaign()
      expect(result.link).toBeNull()
      expect(JSON.stringify(result)).not.toContain(bad)
      const logs = lf.f.readLogs()
      expect(logs).toContain('approval_link')
      expect(logs).not.toContain(bad)
    },
  )

  it('skips a sign-off with a bad email and logs it without the value', async () => {
    await withLink()
    const [first = ''] = (await forCampaign()).variants.map((v) => v.variantId)
    const bad = '<img src=x onerror=alert(1)>@client.example.com'
    plantSignoff('C'.repeat(24), first, 1, bad)
    plantSignoff('D'.repeat(24), first, 1, 'ok@client.example.com')
    const result = await forCampaign()
    const all = result.variants.flatMap((v) => v.signoffs)
    expect(all.map((s) => s.id)).toEqual(['D'.repeat(24)])
    expect(JSON.stringify(result)).not.toContain('onerror')
    const logs = lf.f.readLogs()
    expect(logs).toContain('approval_signoff')
    expect(logs).not.toContain('onerror')
  })

  it('refuses an unknown campaign', async () => {
    await setUp(lf)
    const reply = await lf.f.core.query(
      'approvals.forCampaign',
      pair(lf, 'other-campaign-abc234'),
      asUser,
    )
    expect(reply).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})

describe('approvals.getPassword [spec/approvals.md "Queries and the event"]', () => {
  it('gives the kept password to the user, and null when none is kept', async () => {
    await setUp(lf)
    expect(await getPassword()).toEqual({ password: null })
    await withLink()
    expect(await getPassword()).toEqual({ password: PASSWORD })
  })

  it('refuses the agent before reading anything', async () => {
    await withLink()
    for (const name of ['approvals.getPassword', 'approvals.forCampaign']) {
      const reply = await lf.f.core.query(name, pair(lf), { actor: 'agent' })
      expect(reply).toEqual({
        ok: false,
        error: { code: 'AGENT_DENIED', message: APPROVALS_QUERY_DENIED },
      })
    }
  })
})
