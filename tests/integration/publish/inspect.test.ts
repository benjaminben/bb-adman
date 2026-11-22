// P9-9 (spec/phases/phase-09.md "Publishing", publish.inspect; security class full): the storages
// and their readiness, what is already published for the campaign, and the components with
// their full local paths. User only. Storage is local storage on a temporary folder through
// storageFor; nothing reaches a bucket or Dropbox.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { ProviderFailure, type StorageProvider } from '@/main/providers/types'
import { PUBLISH_INSPECT_DENIED } from '@/shared/publish/messages'
import type { PublishInspect } from '@/shared/schemas/queries/publish'
import { data } from '../core-fixture'
import { BYTES, CAMPAIGN } from './component-project'
import { id, inspectSetUp, type InspectSetUp } from './inspect-setup'

const BG = id(1)
const FONT = id(2)
const GONE = id(3)
const RENAMED = id(4)
const FAKE = { ADMAN_FAKE_PROVIDERS: '1' }
const S3_KEYS = {
  's3.accessKeyId': 'MADEUPACCESSID0001',
  's3.secretAccessKey': 'made-up-secret-01',
}
const DROPBOX_TOKEN = 'made-up-refresh-token-0001'

let s: InspectSetUp | undefined
afterEach(() => {
  s?.cleanup()
  s = undefined
})

const files: Record<string, string> = {}

async function setUp(opts: Parameters<typeof inspectSetUp>[1] = {}) {
  s = await inspectSetUp((p) => {
    files[BG] = p.asset({ id: BG, file: 'bg.png', displayName: 'Beach' })
    files[FONT] = p.asset({ id: FONT, file: 'f.ttf', bytes: BYTES.ttf, kind: 'font' })
    files[GONE] = p.asset({ id: GONE, file: null, displayName: 'Gone' })
    files[RENAMED] = p.asset({ id: RENAMED, file: 'shot.png', bytes: BYTES.mp4 })
    p.layer('vaaaaa', { background: BG })
    p.layer('vbbbbb', { font: FONT })
    p.layer('vccccc', { image: GONE })
    p.layer('vaaaaa', { image: RENAMED })
  }, opts)
  return s
}

async function s3Ready(x: InspectSetUp) {
  const s3 = { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' }
  data(await x.fx.user('settings.update', { storage: { s3 } }))
  for (const [name, value] of Object.entries(S3_KEYS)) {
    data(await x.fx.user('secret.set', { name, value }))
  }
}

function plant(x: InspectSetUp, rel: string, body: string) {
  const file = path.join(x.storageRoot, ...rel.split('/'))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
}

const manifest = (projectId: string, over: object = {}) =>
  JSON.stringify({
    format: 1,
    appVersion: '0.1.0',
    projectId,
    campaignId: CAMPAIGN,
    publishNumber: 4,
    publishedAt: '2026-11-20T10:30:00.000Z',
    files: [],
    ...over,
  })

const ready = (reply: PublishInspect) =>
  Object.fromEntries(reply.storages.map((x) => [x.id, x.ready]))

describe('publish.inspect, storages [P9-9]', () => {
  it('lists S3 and Dropbox, not set up and not signed in, and fake only when listed', async () => {
    const x = await setUp()
    const reply = data<PublishInspect>(await x.inspect({ storage: null }))
    expect(reply.storages).toEqual([
      { id: 's3', label: 'Amazon S3', ready: 'not_set_up' },
      { id: 'dropbox', label: 'Dropbox', ready: 'not_signed_in' },
    ])
    expect(x.opened).toEqual([])
  })

  it('gives each readiness value as the settings and keys change', async () => {
    const x = await setUp({ env: FAKE })
    expect(ready(data(await x.inspect({ storage: null })))).toEqual({
      s3: 'not_set_up',
      dropbox: 'not_signed_in',
      fake: 'ready',
    })
    const s3 = { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' }
    data(await x.fx.user('settings.update', { storage: { s3 } }))
    expect(ready(data(await x.inspect({ storage: null }))).s3).toBe('needs_key')
    await s3Ready(x)
    x.fx.core.deps.secrets.set('dropbox.refreshToken', DROPBOX_TOKEN)
    expect(ready(data(await x.inspect({ storage: null })))).toEqual({
      s3: 'ready',
      dropbox: 'ready',
      fake: 'ready',
    })
  })
})

describe('publish.inspect, existing [P9-9, A-220]', () => {
  it('gives existing null for storage null, and opens no storage', async () => {
    const x = await setUp({ env: FAKE })
    plant(x, `${CAMPAIGN}/report.html`, 'x')
    expect(data<PublishInspect>(await x.inspect({ storage: null })).existing).toBeNull()
    expect(x.opened).toEqual([])
  })

  it.each(['s3', 'dropbox'])('gives existing null for %s when it is not ready', async (storage) => {
    const x = await setUp()
    expect(data<PublishInspect>(await x.inspect({ storage })).existing).toBeNull()
    expect(x.opened).toEqual([])
  })

  it('refuses the fake storage when it is not listed', async () => {
    const x = await setUp()
    expect(await x.inspect({ storage: 'fake' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(x.opened).toEqual([])
  })

  it('gives no files for a campaign with nothing published', async () => {
    const x = await setUp({ env: FAKE })
    plant(x, 'other-camp-zz2345/report.html', 'x')
    expect(data<PublishInspect>(await x.inspect({ storage: 'fake' })).existing).toEqual({
      files: 0,
      publishNumber: null,
      publishedAt: null,
      otherProject: false,
    })
  })

  it('counts the files and reads the number and time from the manifest', async () => {
    const x = await setUp({ env: FAKE })
    plant(x, `${CAMPAIGN}/report.html`, 'x')
    plant(x, `${CAMPAIGN}/exports/Post/1080x1080/en-vaaaaa.png`, 'x')
    plant(x, `${CAMPAIGN}/manifest.json`, manifest(x.projectId))
    plant(x, 'other-camp-zz2345/report.html', 'x')
    expect(data<PublishInspect>(await x.inspect({ storage: 'fake' })).existing).toEqual({
      files: 3,
      publishNumber: 4,
      publishedAt: '2026-11-20T10:30:00.000Z',
      otherProject: false,
    })
    expect(x.opened).toEqual(['fake'])
  })

  it('flags files published from another project', async () => {
    const x = await setUp({ env: FAKE })
    plant(x, `${CAMPAIGN}/manifest.json`, manifest(id(500)))
    expect(data<PublishInspect>(await x.inspect({ storage: 'fake' })).existing).toMatchObject({
      files: 1,
      publishNumber: 4,
      otherProject: true,
    })
  })

  it('counts a damaged manifest as none, logging no content', async () => {
    const x = await setUp({ env: FAKE })
    plant(x, `${CAMPAIGN}/manifest.json`, manifest(x.projectId, { publishNumber: 'secret-ish' }))
    expect(data<PublishInspect>(await x.inspect({ storage: 'fake' })).existing).toEqual({
      files: 1,
      publishNumber: null,
      publishedAt: null,
      otherProject: false,
    })
    expect(x.fx.readLogs()).toContain('manifest_unreadable')
    expect(x.fx.readLogs()).not.toContain('secret-ish')
  })

  it('reads the S3 storage through storageFor once it is ready, with no key in the reply', async () => {
    const x = await setUp()
    await s3Ready(x)
    x.fx.core.deps.secrets.set('dropbox.refreshToken', DROPBOX_TOKEN)
    plant(x, `${CAMPAIGN}/manifest.json`, manifest(x.projectId))
    const replies = [
      await x.inspect({ storage: 's3' }),
      await x.inspect({ storage: 'dropbox' }),
      await x.inspect({ storage: null }),
    ]
    expect(x.opened).toEqual(['s3', 'dropbox'])
    const text = JSON.stringify(replies)
    for (const secret of [...Object.values(S3_KEYS), DROPBOX_TOKEN]) {
      expect(text).not.toContain(secret)
    }
    expect(replies.every((r) => r.ok)).toBe(true)
  })
})

describe('publish.inspect, components [P9-9, A-218, A-223]', () => {
  it('lists every component of the campaign with its full local path and its problem', async () => {
    const x = await setUp()
    const reply = data<PublishInspect>(await x.inspect({ storage: null }))
    const row = (assetId: string) => reply.components.find((c) => c.assetId === assetId)
    expect(reply.components).toHaveLength(4)
    expect(row(BG)).toEqual({
      assetId: BG,
      displayName: 'Beach',
      kind: 'image',
      folder: 'backgrounds',
      localPath: files[BG],
      problem: null,
      share: null,
    })
    expect(row(FONT)).toMatchObject({ kind: 'font', folder: 'fonts', share: 'not_shared' })
    expect(row(GONE)).toMatchObject({ problem: 'missing', localPath: files[GONE] })
    expect(row(RENAMED)).toMatchObject({ problem: 'wrong_type', localPath: files[RENAMED] })
    for (const c of reply.components) {
      expect(Object.keys(c).sort()).toEqual(
        ['assetId', 'displayName', 'folder', 'kind', 'localPath', 'problem', 'share'].sort(),
      )
    }
  })
})

describe('publish.inspect, refusals [P9-9, security]', () => {
  it('refuses the agent before anything is read', async () => {
    const x = await setUp({ env: FAKE })
    const denied = { ok: false, error: { code: 'AGENT_DENIED', message: PUBLISH_INSPECT_DENIED } }
    expect(await x.inspect({ storage: 'fake' }, 'agent')).toEqual(denied)
    expect(await x.inspect({ storage: 'fake', campaignId: 'nope-zz9999' }, 'agent')).toEqual(denied)
    const raw = await x.fx.core.query('publish.inspect', { extra: 1 }, { actor: 'agent' })
    expect(raw).toEqual(denied)
    expect(x.opened).toEqual([])
  })

  it('checks the input', async () => {
    const x = await setUp()
    for (const bad of [{ storage: 'azure-blob' }, { storage: null, extra: 1 }]) {
      expect(await x.inspect(bad)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    }
  })

  it('gives NOT_FOUND for an unknown campaign, opening no storage', async () => {
    const x = await setUp({ env: FAKE })
    expect(await x.inspect({ storage: 'fake', campaignId: 'nope-zz9999' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
    expect(x.opened).toEqual([])
  })

  it('gives a failing storage as PROVIDER_ERROR with the fixed sentence and no detail', async () => {
    const detail = `AccessDenied for ${S3_KEYS['s3.accessKeyId']} at https://made-up.example.com/x?X-Amz-Signature=abc`
    const fail = (): never => {
      throw new ProviderFailure({ kind: 'offline', detail })
    }
    const failing: StorageProvider = {
      exists: async () => fail(),
      read: async () => fail(),
      write: async () => fail(),
      list: async () => fail(),
      remove: async () => fail(),
    }
    const x = await setUp({ env: FAKE, storage: failing })
    const reply = await x.inspect({ storage: 'fake' })
    expect(reply).toEqual({
      ok: false,
      error: {
        code: 'PROVIDER_ERROR',
        message:
          'Adman could not look at the published folder. The app could not reach Fake provider. Check your internet connection and try again.',
        details: { provider: 'fake', kind: 'offline' },
      },
    })
    expect(JSON.stringify(reply)).not.toContain('AccessDenied')
    expect(x.fx.readLogs()).not.toContain(S3_KEYS['s3.accessKeyId'])
    expect(x.fx.readLogs()).not.toContain('X-Amz-Signature')
  })

  it('gives a storage that throws anything else the same sentence, kind other', async () => {
    const odd = new Error(`boom ${S3_KEYS['s3.secretAccessKey']}`)
    const failing = { list: async () => Promise.reject(odd) } as unknown as StorageProvider
    const x = await setUp({ env: FAKE, storage: failing })
    const reply = await x.inspect({ storage: 'fake' })
    expect(reply).toMatchObject({
      ok: false,
      error: { code: 'PROVIDER_ERROR', details: { provider: 'fake', kind: 'other' } },
    })
    expect(JSON.stringify(reply)).not.toContain('boom')
    expect(x.fx.readLogs()).not.toContain(S3_KEYS['s3.secretAccessKey'])
  })
})
