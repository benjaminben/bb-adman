import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import type Database from 'better-sqlite3'
import {
  makeGenerationFixture,
  BACKGROUND_LAYER,
  OTHER_LAYER,
  TEXT_LAYER,
  VARIANT,
  type GenerationFixture,
} from './generation-fixture'
import { data } from '../core-fixture'
import { promptToSend } from '../../../src/shared/generation/prompt'

let f: GenerationFixture
afterEach(() => f.cleanup())

const base = { variantId: VARIANT, prompt: 'A bottle on a rock', referenceAssetIds: [], count: 2 }
const run = (input: Record<string, unknown>) =>
  f.user('generation.runImages', { ...base, slot: 'background', provider: 'fake', ...input })

function dump(db: Database.Database): string {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as Array<{ name: string }>
  return JSON.stringify(tables.map((t) => db.prepare(`SELECT * FROM "${t.name}"`).all()))
}

// SPEC 10.1 rule 4: the exact code and reason, no row written, no project.changed.
async function expectRefused(
  call: () => Promise<unknown>,
  code: string,
  reason?: string,
): Promise<{ code: string; message: string; details?: Record<string, unknown> }> {
  const before = dump(f.db)
  const events = f.events.length
  const r = (await call()) as {
    ok: boolean
    error: { code: string; message: string; details?: Record<string, unknown> }
  }
  expect(r.ok).toBe(false)
  expect(r.error.code).toBe(code)
  if (reason) expect(r.error.details?.reason).toBe(reason)
  expect(dump(f.db)).toBe(before)
  expect(f.events.slice(events).filter((e) => e.name === 'project.changed')).toEqual([])
  expect(f.jobs()).toEqual([])
  return r.error
}

describe('generation.runImages [SPEC 4.2, 3.6 "Jobs" item 1; FR-062 to FR-065]', () => {
  it('enqueues one image job for a slot with its campaign, variant and slot, and returns its ID', async () => {
    f = await makeGenerationFixture()
    const ref = await f.importPicture()
    const r = await run({ referenceAssetIds: [ref], count: 3 })
    const { jobId } = data<{ jobId: string }>(r)
    expect(f.job(jobId)).toMatchObject({
      kind: 'image_generation',
      campaignId: 'c1',
      variantId: VARIANT,
      layerId: null,
      slot: 'background',
      provider: 'fake',
      model: '',
      startedBy: 'user',
      request: {
        prompt: promptToSend('A bottle on a rock'),
        referenceAssetIds: [ref],
        count: 3,
        width: 1080,
        height: 1350,
      },
    })
  })

  it('records the layer, and no slot, when it is given a layer', async () => {
    f = await makeGenerationFixture()
    const r = await f.user('generation.runImages', {
      ...base,
      layerId: BACKGROUND_LAYER,
      provider: 'fake',
    })
    const { jobId } = data<{ jobId: string }>(r)
    expect(f.job(jobId)).toMatchObject({ layerId: BACKGROUND_LAYER, slot: null })
  })

  it('accepts the other image slots of the starter template', async () => {
    f = await makeGenerationFixture()
    for (const slot of ['subject-image', 'logo']) expect((await run({ slot })).ok).toBe(true)
  })

  it('refuses a variant that is not there with NOT_FOUND', async () => {
    f = await makeGenerationFixture()
    await expectRefused(() => run({ variantId: 'nope' }), 'NOT_FOUND')
  })

  it('refuses a layer that is not in the variant with NOT_FOUND', async () => {
    f = await makeGenerationFixture()
    await expectRefused(
      () => f.user('generation.runImages', { ...base, layerId: OTHER_LAYER, provider: 'fake' }),
      'NOT_FOUND',
    )
    await expectRefused(
      () => f.user('generation.runImages', { ...base, layerId: 'nope', provider: 'fake' }),
      'NOT_FOUND',
    )
  })

  it('refuses a text layer with INVALID_INPUT', async () => {
    f = await makeGenerationFixture()
    await expectRefused(
      () => f.user('generation.runImages', { ...base, layerId: TEXT_LAYER, provider: 'fake' }),
      'INVALID_INPUT',
    )
  })

  it('refuses a copy slot or a slot the template does not have with INVALID_INPUT', async () => {
    f = await makeGenerationFixture()
    await expectRefused(() => run({ slot: 'headline' }), 'INVALID_INPUT')
    await expectRefused(() => run({ slot: 'nope' }), 'INVALID_INPUT')
  })

  it('refuses a provider that is not there, cannot make pictures, or is not in this build', async () => {
    f = await makeGenerationFixture()
    for (const provider of ['nope', 's3', 'firefly']) {
      await expectRefused(() => run({ provider }), 'INVALID_INPUT')
    }
  })

  it('calls the key guard: Gemini with no key saved is NEEDS_KEY and no job row is made [FR-171]', async () => {
    f = await makeGenerationFixture()
    const error = await expectRefused(() => run({ provider: 'gemini' }), 'NEEDS_KEY')
    expect(error.details?.provider).toBe('gemini')
    expect(error.message).toBe('Add your Google Gemini key to generate pictures.')
  })

  it('refuses a reference asset that is not there with NOT_FOUND', async () => {
    f = await makeGenerationFixture()
    await expectRefused(() => run({ referenceAssetIds: ['nope'] }), 'NOT_FOUND')
  })

  it('refuses a reference whose file is gone with MISSING_FILE', async () => {
    f = await makeGenerationFixture()
    const ref = await f.importPicture('gone.png')
    fs.rmSync(path.join(f.root, 'gone.png'))
    await expectRefused(() => run({ referenceAssetIds: [ref] }), 'MISSING_FILE')
  })

  it('refuses a reference that is not a picture: asset_not_a_picture', async () => {
    f = await makeGenerationFixture()
    const file = path.join(f.root, 'note.txt')
    fs.writeFileSync(file, 'hello')
    const r = await f.user('asset.import', { paths: [file], library: 'reference', copy: false })
    const [id] = data<{ assetIds: string[] }>(r).assetIds
    await expectRefused(
      () => run({ referenceAssetIds: [id] }),
      'RULE_VIOLATION',
      'asset_not_a_picture',
    )
  })

  it('refuses nine pictures with INVALID_INPUT', async () => {
    f = await makeGenerationFixture()
    await expectRefused(() => run({ count: 9 }), 'INVALID_INPUT')
  })
})
