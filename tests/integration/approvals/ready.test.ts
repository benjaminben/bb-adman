// requireApprovalsReady (spec/approvals.md "Refusals every project-scope one shares"): the
// shared refusals, each in its place in the order.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { requireApprovalsReady, type ReadyOptions } from '@/main/approvals/ready'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { APPROVALS_REASON_MESSAGES, type ApprovalsReason } from '@/shared/approvals/messages'

const KEY = 'made-up-approvals-key-for-the-ready-test-0007'
const ORIGIN = 'https://approvals.example.com'
let f: Fixture
let projectId = ''
let campaignId = ''

beforeEach(async () => {
  f = makeFixture()
  projectId = data<{ projectId: string }>(
    await f.user('project.create', { name: 'Ready', location: f.projectsDir }),
  ).projectId
  campaignId = data<{ campaignId: string }>(
    await f.user('campaign.create', { projectId, ...createInput() }),
  ).campaignId
})
afterEach(() => f.cleanup())

async function setUp(parts: { service?: boolean; bucket?: boolean; s3Keys?: boolean }) {
  if (parts.service !== false) {
    await f.user('approvals.setService', { address: ORIGIN })
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

const ready = (opts: Partial<ReadyOptions> & { campaign?: string }) => () =>
  requireApprovalsReady(
    f.core.deps,
    f.core.projects.requireOpen(projectId).db,
    opts.campaign ?? campaignId,
    { bucket: true, link: 'none', linkIsLive: () => false, ...opts },
  )
const refusal = (reason: ApprovalsReason) =>
  expect.objectContaining({
    code: 'RULE_VIOLATION',
    message: APPROVALS_REASON_MESSAGES[reason],
    details: { reason },
  })

describe('requireApprovalsReady [spec/approvals.md "Commands"]', () => {
  it('gives the saved origin and key when everything is ready', async () => {
    await setUp({})
    expect(ready({})()).toEqual({ origin: ORIGIN, key: KEY })
  })

  it('refuses an unknown campaign first, even with nothing set up', async () => {
    expect(ready({ campaign: 'other-campaign-abc234' })).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it.each([
    ['no address or key', { service: false }],
    ['no address or key, and no bucket', { service: false, bucket: false }],
  ])('refuses as not set up with %s', async (_n, parts) => {
    await setUp(parts)
    expect(ready({})).toThrow(refusal('approvals_not_set_up'))
  })

  it('refuses as not set up with a key and no address', async () => {
    await f.user('secret.set', { name: 'approvals.apiKey', value: KEY })
    expect(ready({})).toThrow(refusal('approvals_not_set_up'))
  })

  it('refuses with no bucket, or an empty bucket or region, only when the bucket is needed', async () => {
    await setUp({ bucket: false })
    expect(ready({})).toThrow(refusal('approvals_needs_bucket'))
    f.core.settings.update({ storage: { s3: { bucket: ' ', region: 'eu-west-1', prefix: '' } } })
    expect(ready({})).toThrow(refusal('approvals_needs_bucket'))
    f.core.settings.update({ storage: { s3: { bucket: 'b', region: '', prefix: '' } } })
    expect(ready({})).toThrow(refusal('approvals_needs_bucket'))
    expect(ready({ bucket: false })()).toEqual({ origin: ORIGIN, key: KEY })
  })

  it('asks for the S3 keys after the bucket', async () => {
    await setUp({ s3Keys: false })
    expect(ready({})).toThrow(expect.objectContaining({ code: 'NEEDS_KEY' }))
  })

  it('refuses by link state last', async () => {
    await setUp({})
    expect(ready({ link: 'none', linkIsLive: () => true })).toThrow(refusal('approval_link_exists'))
    expect(ready({ link: 'live', linkIsLive: () => false })).toThrow(
      refusal('approval_link_missing'),
    )
    expect(ready({ link: 'live', linkIsLive: () => true })()).toEqual({ origin: ORIGIN, key: KEY })
  })

  it('does not ask the link state before the other refusals', async () => {
    let asked = false
    expect(ready({ linkIsLive: () => (asked = true) })).toThrow(refusal('approvals_not_set_up'))
    expect(asked).toBe(false)
  })
})
