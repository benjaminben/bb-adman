// spec/approvals.md "Rules a developer must not break": a signed picture address, the service
// key, a link password and a reviewer's email never reach a log line, an event or a reply.
// Publish and refresh run through success, failure, renewal and a gone link with each value
// planted, then the logs, the events and the replies are searched for them.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { PictureStore } from '@/main/approvals/types'
import { ExportFailure } from '@/main/export/failure'
import { noMediaTool } from '@/main/media/no-media'
import { ProviderFailure } from '@/main/providers/types'
import { data } from '../core-fixture'
import {
  KEY,
  makeLinkFixture,
  pair,
  setUp,
  stubDraw,
  variantsOf,
  type LinkFixture,
} from './link-fixture'

const PASSWORD = 'the-link-password-secret-0009'
const SIGNATURE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90signature'
const EMAIL = 'reviewer.secret@client.example.com'
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
  await setUp(lf)
  data(await lf.f.user('approvals.createLink', { ...pair(lf), password: PASSWORD }))
  const real = lf.f.core.deps.approvals.pictures()
  // A signed address shaped as S3 gives it, with the signature planted.
  const store: PictureStore = {
    ...real,
    signedUrl: async (p, s) => {
      const signed = await real.signedUrl(p, s)
      return { ...signed, url: `${signed.url}?X-Amz-Signature=${SIGNATURE}` }
    },
  }
  vi.spyOn(lf.f.core.deps.approvals, 'pictures').mockReturnValue(store)
  stubDraw(lf)
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const soon = () =>
  lf
    .db()
    .prepare('UPDATE approval_variant SET expires_at = ? WHERE campaign_id = ?')
    .run(new Date(Date.now() + 3_600_000).toISOString(), lf.c1)

describe('publish and refresh keep secrets out of logs, events and replies', () => {
  it('holds no signed address, key, password or email after every path', async () => {
    const replies: unknown[] = []
    const run = async (name: string) => replies.push(await lf.f.user(name, pair(lf)))
    await run('approvals.publish')
    const [v1] = variantsOf(lf)
    lf.stand.plantSignoff(lf.projectId, lf.c1, {
      id: 'S'.repeat(24),
      variantKey: v1!.id,
      version: v1!.rev,
      email: EMAIL,
      signedAt: '2026-11-02T10:00:00.000Z',
    })
    soon()
    await run('approvals.refresh')
    soon()
    lf.stand.once('renewPictures', { status: 500, json: { error: { code: 'x', message: EMAIL } } })
    await run('approvals.refresh')
    lf.stand.once('replaceGallery', { status: 500, json: { error: { code: 'x', message: KEY } } })
    lf.db().prepare('UPDATE variant SET rev = rev + 1').run()
    await run('approvals.publish')
    lf.stand.links.delete(`${lf.projectId}/${lf.c1}`)
    await run('approvals.refresh')
    await Promise.resolve()
    const url = lf.stand.seen.find((s) => s.route === 'replaceGallery')?.body ?? ''
    expect(url).toContain(SIGNATURE)
    expect(lf.stand.seen.filter((s) => s.route === 'renewPictures')).toHaveLength(2)
    const logs = lf.f.readLogs()
    const events = JSON.stringify(lf.f.events)
    const answers = JSON.stringify(replies)
    expect(logs).toContain('approvals.publish')
    for (const secret of [SIGNATURE, KEY, PASSWORD, EMAIL, lf.stand.origin]) {
      expect(logs).not.toContain(secret)
      expect(events).not.toContain(secret)
      expect(answers).not.toContain(secret)
    }
    const changed = lf.f.events.filter((e) => e.name === 'approvals.changed')
    for (const e of changed) {
      expect(e.payload).toEqual({ projectId: lf.projectId, campaignId: lf.c1 })
    }
  })

  // R2V-5, SV-11: with clip addresses planted too, a video variant's success, renewal, failed
  // export, failed clip upload and gone link leave no signed address, path or key behind, and
  // no job row is added.
  it('holds no signed clip address or path after the clip paths', async () => {
    const video = variantsOf(lf)[0]!.id
    lf.db()
      .prepare("UPDATE variant SET format = 'video', duration_ms = 5000 WHERE id = ?")
      .run(video)
    Object.assign(lf.f.core.deps, { media: { ...noMediaTool, available: () => true } })
    let failExport = false
    vi.spyOn(lf.f.core.deps.export.video, 'exportVariant').mockImplementation(
      async (_jc, _scene, plan, target, file) => {
        if (failExport) throw new ExportFailure(`could not write ${plan.root} ${SIGNATURE}`)
        await target.write(file, new Uint8Array([0, 0, 0, 8, 102, 116, 121, 112]))
        return { still: null }
      },
    )
    const jobs = () => (lf.db().prepare('SELECT COUNT(*) AS n FROM job').get() as { n: number }).n
    const jobsBefore = jobs()
    const replies: unknown[] = []
    const run = async (name: string) => replies.push(await lf.f.user(name, pair(lf)))
    await run('approvals.publish')
    const shown = lf.stand.links.get(`${lf.projectId}/${lf.c1}`)?.gallery[0]
    expect(shown?.clip?.clipUrl).toContain(SIGNATURE)
    soon()
    await run('approvals.refresh')
    expect(
      JSON.parse(lf.stand.seen.filter((s) => s.route === 'renewPictures')[0]!.body),
    ).toMatchObject({
      pictures: [{ clipUrl: expect.stringContaining(SIGNATURE) }],
    })
    lf.db().prepare('UPDATE variant SET rev = rev + 1').run()
    failExport = true
    await run('approvals.publish')
    failExport = false
    const real = lf.f.core.deps.approvals.pictures()
    vi.spyOn(lf.f.core.deps.approvals, 'pictures').mockReturnValue({
      ...real,
      putClip: async () => {
        throw new ProviderFailure({ kind: 'offline', detail: `${SIGNATURE} ${lf.f.userData}` })
      },
    })
    await run('approvals.publish')
    lf.stand.links.delete(`${lf.projectId}/${lf.c1}`)
    await run('approvals.publish')
    await Promise.resolve()
    expect(JSON.stringify(replies)).toContain('clip_failed')
    expect(JSON.stringify(replies)).toContain('PROVIDER_ERROR')
    const logs = lf.f.readLogs()
    const events = JSON.stringify(lf.f.events)
    const answers = JSON.stringify(replies)
    const project = path.dirname(lf.f.core.projects.requireOpen(lf.projectId).filePath)
    expect(logs).toContain('clipMake')
    expect(logs).toContain('clipUpload')
    for (const secret of [
      SIGNATURE,
      KEY,
      PASSWORD,
      lf.stand.origin,
      lf.f.userData,
      project,
      '.mp4',
    ]) {
      expect(logs).not.toContain(secret)
      expect(events).not.toContain(secret)
      expect(answers).not.toContain(secret)
    }
    expect(jobs()).toBe(jobsBefore)
    expect(fs.existsSync(path.join(lf.f.userData, 'export-work'))).toBe(true)
    expect(fs.readdirSync(path.join(lf.f.userData, 'export-work'))).toEqual([])
  })
})
