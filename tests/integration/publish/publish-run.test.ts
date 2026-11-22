// P9-10 (spec/phases/phase-09.md "Publishing", publish.run; security class full): the refusals
// come in their order and leave no job row; files in the campaign folder need the replace
// confirmation whatever the old manifest says; warnings need "publish anyway"; success queues
// one publish job and answers its ID only. User only. Storage is local storage on a temporary
// folder; nothing reaches a bucket or Dropbox.
import { describe, it, expect, afterEach } from 'vitest'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import { ProviderFailure, type StorageProvider } from '@/main/providers/types'
import { insertCampaign } from '../row-fixtures'
import { data } from '../core-fixture'
import { CAMPAIGN } from './component-project'
import { publishSetUp, type PublishSetUp } from './publish-setup'

const BAD_ID = 'Bad_Campaign'
const S3 = { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' }
const S3_KEYS = {
  's3.accessKeyId': 'MADEUPACCESSID0002',
  's3.secretAccessKey': 'made-up-secret-02',
}
const WARNING = {
  variantId: 'vaaaaa',
  title: 'Text too small',
  message: 'The price is hard to read.',
}

let s: PublishSetUp | undefined
afterEach(() => {
  s?.cleanup()
  s = undefined
})

async function setUp(opts: Parameters<typeof publishSetUp>[1] = {}) {
  s = await publishSetUp((p) => insertCampaign(p.db, BAD_ID), opts)
  return s
}

const refusal = (reason: string) => ({ ok: false, error: { details: { reason } } })

const manifestOf = (projectId: string) =>
  JSON.stringify({
    format: 1,
    appVersion: '0.1.0',
    projectId,
    campaignId: CAMPAIGN,
    publishNumber: 2,
    publishedAt: '2026-11-20T10:30:00.000Z',
    files: [],
  })

describe('publish.run, refusals in order [P9-10]', () => {
  it('refuses an unknown campaign with NOT_FOUND, then an unsafe campaign ID', async () => {
    const x = await setUp()
    expect(await x.run({ campaignId: 'no-such-camp-aa1111' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
    expect(await x.run({ campaignId: BAD_ID, storage: 's3' })).toMatchObject({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: "This campaign's ID cannot be used as a folder name.",
        details: { reason: 'campaign_id_unsafe' },
      },
    })
    expect(x.jobs()).toEqual([])
    expect(x.opened).toEqual([])
  })

  it('refuses fake when it is not listed, before any storage is opened', async () => {
    const x = await setUp({ env: {} })
    expect(await x.run()).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(x.jobs()).toEqual([])
    expect(x.opened).toEqual([])
  })

  it('refuses S3 not set up, then NEEDS_KEY', async () => {
    const x = await setUp()
    expect(await x.run({ storage: 's3' })).toMatchObject(refusal('storage_not_set_up'))
    data(await x.fx.user('settings.update', { storage: { s3: S3 } }))
    expect(await x.run({ storage: 's3' })).toMatchObject({
      ok: false,
      error: { code: 'NEEDS_KEY' },
    })
    for (const [name, value] of Object.entries(S3_KEYS)) {
      data(await x.fx.user('secret.set', { name, value }))
    }
    expect(data(await x.run({ storage: 's3' }))).toEqual({ jobId: expect.any(String) })
    expect(x.opened).toEqual(['s3'])
  })

  it('refuses Dropbox not signed in, then a saved folder that fails the check', async () => {
    const x = await setUp()
    expect(await x.run({ storage: 'dropbox' })).toMatchObject(refusal('dropbox_not_signed_in'))
    x.fx.core.deps.secrets.set('dropbox.refreshToken', 'made-up-refresh-token-0002')
    x.fx.core.deps.settings.setDropbox({ accountName: 'Ann Example', rootPath: 'a/../b' })
    expect(await x.run({ storage: 'dropbox' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', details: { reason: 'dropbox_folder_refused' } },
    })
    expect(x.jobs()).toEqual([])
    expect(x.opened).toEqual([])
  })

  it('refuses while a publish job of this campaign is queued or running', async () => {
    const x = await setUp()
    const db = x.fx.core.deps.projects.get(x.projectId)?.db
    for (const status of ['queued', 'running']) {
      db?.prepare(
        `INSERT INTO job (id, kind, status, campaign_id, request, created_at, updated_at)
         VALUES (?, 'publish', ?, ?, '{}', 'x', 'x')`,
      ).run(`job-${status}`, status, CAMPAIGN)
      expect(await x.run({ replaceConfirmed: true })).toMatchObject({
        ok: false,
        error: {
          message: 'This campaign is being published. Wait until it ends.',
          details: { reason: 'publish_running' },
        },
      })
      db?.prepare("UPDATE job SET status = 'failed' WHERE id = ?").run(`job-${status}`)
    }
    expect(x.opened).toEqual([])
  })

  it('refuses replace_not_confirmed only when files exist, whatever the old manifest says', async () => {
    const x = await setUp()
    x.plant(`${CAMPAIGN}x/report.html`, 'a neighbour folder')
    x.plant('other-camp-zz2345/report.html', 'another campaign')
    const first = data<{ jobId: string }>(await x.run())
    await x.ended(first.jobId)
    // A file and no manifest: no "other project" flag, still files.
    x.plant(`${CAMPAIGN}/report.html`, 'old report')
    expect(await x.run()).toMatchObject({
      ok: false,
      error: {
        message: 'This campaign already has published files. Confirm that they will be replaced.',
        details: { reason: 'replace_not_confirmed' },
      },
    })
    // A manifest of this same project does not stand in for the confirmation either.
    x.plant(`${CAMPAIGN}/manifest.json`, manifestOf(x.projectId))
    expect(await x.run()).toMatchObject(refusal('replace_not_confirmed'))
    expect(x.jobs().map((j) => j.id)).toEqual([first.jobId])
    expect(data(await x.run({ replaceConfirmed: true }))).toEqual({ jobId: expect.any(String) })
  })

  it('refuses publish_has_warnings with the warnings, then queues with publish anyway', async () => {
    const x = await setUp()
    x.warnings = [WARNING]
    expect(await x.run()).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'Some ads have warnings. Fix them or publish anyway.',
        details: { reason: 'publish_has_warnings', warnings: [WARNING] },
      },
    })
    expect(x.jobs()).toEqual([])
    const reply = await x.run({ proceedDespiteWarnings: true, proceedReason: 'Client signed off' })
    expect(data(reply)).toEqual({ jobId: expect.any(String) })
  })

  it('checks the replace confirmation before the warnings', async () => {
    const x = await setUp()
    x.warnings = [WARNING]
    x.plant(`${CAMPAIGN}/report.html`, 'old report')
    expect(await x.run()).toMatchObject(refusal('replace_not_confirmed'))
    expect(await x.run({ replaceConfirmed: true })).toMatchObject(refusal('publish_has_warnings'))
  })

  it('gives PROVIDER_ERROR with a fixed sentence and no detail when the folder cannot be read', async () => {
    const secretDetail = '403 made-up-signed-address?X-Amz-Signature=abc'
    const failing: StorageProvider = {
      exists: async () => false,
      read: async () => new Uint8Array(),
      write: async () => undefined,
      list: async () => {
        throw new ProviderFailure({ kind: 'bad_key', detail: secretDetail })
      },
      remove: async () => undefined,
    }
    const x = await setUp({ env: { ADMAN_FAKE_PROVIDERS: '1' }, storage: failing })
    const reply = await x.run()
    expect(reply).toMatchObject({ ok: false, error: { code: 'PROVIDER_ERROR' } })
    const text = JSON.stringify(reply)
    expect(text).toContain('Adman could not look at the published folder.')
    expect(text).not.toContain('Signature')
    expect(x.fx.readLogs()).not.toContain('Signature')
    expect(x.jobs()).toEqual([])
  })
})

describe('publish.run, the job it queues [P9-10]', () => {
  it('queues one publish job with the storage as provider, and answers its ID only', async () => {
    const x = await setUp()
    const reply = await x.run({ proceedReason: 'A reason only the report holds' })
    const { jobId } = data<{ jobId: string }>(reply)
    expect(reply).toEqual({ ok: true, data: { jobId } })
    const jobs = x.jobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      id: jobId,
      kind: 'publish',
      provider: 'fake',
      campaignId: CAMPAIGN,
      startedBy: 'user',
      paidCalls: 0,
    })
    expect(JSON.stringify(jobs[0])).not.toContain('A reason only the report holds')
    expect(x.fx.readLogs()).not.toContain('A reason only the report holds')
  })

  it('is AGENT_DENIED for an agent, before anything is read', async () => {
    const x = await setUp()
    // Moved from the P9-1 stub table: deny, with its own action, and not internal.
    expect(AGENT_POLICY['publish.run']).toEqual({ policy: 'deny', action: 'publish' })
    expect(x.fx.core.isInternal('publish.run')).toBe(false)
    expect(await x.run({}, 'agent')).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('publish.run') },
    })
    expect(x.jobs()).toEqual([])
    expect(x.opened).toEqual([])
  })
})
