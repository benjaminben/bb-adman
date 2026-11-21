import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetAddGenerated } from '@/main/commands/asset/add-generated'
import { insertQueued } from '@/main/jobs/job-store'
import { createAssetService } from '@/main/assets/service'
import { readWireRow } from '@/main/db/rows'
import { greyPng } from '@/main/providers/fake/png'
import { makeAssetBus, expectRefused } from './asset-bus'
import type { AssetRow } from '@/shared/schemas/rows/asset'

let bus: ReturnType<typeof makeAssetBus>
const JOB = '01JD00000000000000000000J1'
const A1 = '01JD0000000000000000000A01'
const A2 = '01JD0000000000000000000A02'
const NOW = new Date('2026-11-20T14:30:00.000Z')
const assets = createAssetService()

beforeEach(() => {
  bus = makeAssetBus([assetAddGenerated({ now: () => NOW })])
  insertQueued(
    bus.project,
    JOB,
    {
      kind: 'image_generation',
      campaignId: 'c1',
      variantId: 'v1',
      layerId: null,
      slot: 'background',
      provider: 'fake',
      model: 'test-model-1',
      request: { prompt: 'A bottle on a rock', referenceAssetIds: [], count: 2 },
      startedBy: 'user',
    },
    'x',
  )
})
afterEach(() => bus.cleanup())

const write = (assetId: string, bytes: Uint8Array) =>
  assets.writeManaged(bus.project, { assetId, ext: 'png', bytes })
const row = (id: string) => readWireRow(bus.db, 'asset', { id }) as AssetRow | null
const add = (files: Array<{ assetId: string; ext: string }>, jobId = JOB) =>
  bus.user('asset.addGenerated', { jobId, files })

describe('asset.addGenerated [SPEC 4.2 notes; FR-063, FR-068, FR-216]', () => {
  it('inserts one generated, managed asset row per file, with the facts read from the file', async () => {
    const png = greyPng(6, 4)
    await write(A1, png)
    await write(A2, greyPng(3, 3))
    const result = await bus.changed(() =>
      add([
        { assetId: A1, ext: 'png' },
        { assetId: A2, ext: 'png' },
      ]),
    )
    expect(result).toMatchObject({ ok: true, data: { assetIds: [A1, A2] } })
    const file = path.join(assets.assetsDir(bus.project), `${A1}.png`)
    expect(row(A1)).toMatchObject({
      id: A1,
      library: 'asset',
      kind: 'image',
      origin: 'generated',
      storage: 'managed',
      subjectId: null,
      displayName: `${A1}.png`,
      absPath: file,
      relPath: path.relative(path.dirname(bus.project.filePath), file),
      mime: 'image/png',
      byteSize: png.byteLength,
      mtimeMs: Math.trunc(fs.statSync(file).mtimeMs),
      contentHash: crypto.createHash('sha256').update(png).digest('hex'),
      width: 6,
      height: 4,
      genRunId: JOB,
      genProvider: 'fake',
      genModel: 'test-model-1',
      genPrompt: 'A bottle on a rock',
      createdAt: NOW.toISOString(),
    })
    expect(row(A2)).toMatchObject({ width: 3, height: 3, genRunId: JOB })
  })

  it('is internal: marked so the IPC edge answers a window that names it as unknown', () => {
    expect(assetAddGenerated({ now: () => NOW }).internal).toBe(true)
  })

  it('refuses a job ID that names no job with NOT_FOUND and writes nothing', async () => {
    await write(A1, greyPng(2, 2))
    await expectRefused(bus, () => add([{ assetId: A1, ext: 'png' }], 'nope'), 'NOT_FOUND')
  })

  it('refuses a file that is not in the assets folder with NOT_FOUND and writes nothing', async () => {
    await write(A1, greyPng(2, 2))
    await expectRefused(
      bus,
      () =>
        add([
          { assetId: A1, ext: 'png' },
          { assetId: A2, ext: 'png' },
        ]),
      'NOT_FOUND',
    )
    expect(row(A1)).toBeNull()
  })

  it('refuses an asset ID that is not a safe file name before any file is read', async () => {
    await expectRefused(bus, () => add([{ assetId: '../x', ext: 'png' }]), 'INVALID_INPUT')
  })

  it('refuses a file of a type the app does not accept with INVALID_INPUT', async () => {
    await assets.writeManaged(bus.project, {
      assetId: A1,
      ext: 'png',
      bytes: new Uint8Array([1, 2, 3, 4]),
    })
    await expectRefused(bus, () => add([{ assetId: A1, ext: 'png' }]), 'INVALID_INPUT')
  })

  it('reads the file at the managed path only, whatever else the input holds', async () => {
    await write(A1, greyPng(2, 2))
    const outside = path.join(path.dirname(bus.project.filePath), 'other.png')
    fs.writeFileSync(outside, greyPng(9, 9))
    const r = await bus.user('asset.addGenerated', {
      jobId: JOB,
      files: [{ assetId: A1, ext: 'png', path: outside }],
    })
    expect(r.ok).toBe(true)
    expect(row(A1)).toMatchObject({ width: 2, height: 2 })
  })
})

describe('asset.addGenerated for a job with no prompt [P4-11; spec/ai-jobs.md "Cut-out"]', () => {
  it('writes gen_prompt null when the job request has no prompt', async () => {
    const CUT = '01JD00000000000000000000J2'
    insertQueued(
      bus.project,
      CUT,
      {
        kind: 'cutout',
        campaignId: 'c1',
        variantId: 'v1',
        layerId: null,
        slot: null,
        provider: 'fake',
        model: 'fake-cutout',
        request: { sourceAssetId: 'src' },
        startedBy: 'user',
      },
      'x',
    )
    await write(A1, greyPng(2, 2))
    expect(await add([{ assetId: A1, ext: 'png' }], CUT)).toMatchObject({ ok: true })
    expect(row(A1)).toMatchObject({ genRunId: CUT, genPrompt: null, genModel: 'fake-cutout' })
  })
})
