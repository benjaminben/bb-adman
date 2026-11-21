import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { greyPng } from '@/main/providers/fake/png'
import { makeKindFixture, pngAnswer, type KindFixture } from './kind-fixture'
import { waitFor } from './generation-fixture'

let f: KindFixture
afterEach(() => f.cleanup())

const done = (id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(f.job(id)?.status ?? '')

describe('an unforeseen error in an image job sends no further call [SPEC 6.11.1; cost]', () => {
  it('a provider error that is not a ProviderFailure ends the job failed as other after the calls already sent', async () => {
    f = makeKindFixture()
    f.t.answers = [
      async () => {
        throw new Error('Something broke')
      },
      pngAnswer(),
    ]
    const id = await f.start({ count: 6 })
    await waitFor(done(id))
    expect(f.job(id)).toMatchObject({ status: 'failed', errorKind: 'other' })
    expect(f.calls.length).toBeLessThanOrEqual(2)
    expect(f.job(id)?.paidCalls).toBe(f.calls.length)
  })

  it('a picture that cannot be written ends the job failed as other and sends no further call', async () => {
    f = makeKindFixture()
    // Something that is not a folder stands where the assets folder goes.
    fs.writeFileSync(f.assetsDir(), 'not a folder')
    const id = await f.start({ count: 6 })
    await waitFor(done(id))
    expect(f.job(id)).toMatchObject({ status: 'failed', errorKind: 'other' })
    expect(f.calls.length).toBeLessThanOrEqual(2)
    expect(f.assets()).toEqual([])
  })
})

describe('an AppError after enqueue puts no file path in the job row or the log [SPEC 14 1.42 H-R6, H4-2]', () => {
  it('a reference file gone before the job starts: failed as other, no path anywhere', async () => {
    f = makeKindFixture()
    const file = path.join(f.root, 'ref.png')
    fs.writeFileSync(file, greyPng(5, 4))
    const imported = await f.user('asset.import', {
      paths: [file],
      library: 'reference',
      copy: false,
    })
    const refId = (imported as { data: { assetIds: string[] } }).data.assetIds[0]
    // Four jobs hold the provider's places (JOBS_AT_ONCE_PER_PROVIDER), so the fifth waits.
    let open = () => {}
    const gate = new Promise<void>((r) => (open = r))
    f.t.answers = Array.from({ length: 4 }, () => () => gate.then(() => [pngAnswer()]))
    const holders = await Promise.all(Array.from({ length: 4 }, () => f.start({ count: 1 })))
    const id = await f.start({ count: 1, referenceAssetIds: [refId] })
    expect(f.job(id)?.status).toBe('queued')
    fs.rmSync(file)
    open()
    for (const h of [...holders, id]) await waitFor(done(h))
    expect(f.job(id)).toMatchObject({ status: 'failed', errorKind: 'other', paidCalls: 0 })
    expect(JSON.stringify(f.job(id))).not.toContain(file)
    const logDir = path.join(f.root, 'logs')
    const logText = fs.readdirSync(logDir).map((n) => fs.readFileSync(path.join(logDir, n), 'utf8'))
    const lines = logText
      .join('')
      .split('\n')
      .filter((l) => l.includes(id))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line).not.toContain(file)
  })
})
