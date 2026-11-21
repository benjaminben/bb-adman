// P5-8: generation.runFill through the real core (spec/links-and-sync.md "Generative fill";
// A-132, A-146). Each refusal in its order, before any job row; the source read through
// AssetService.read in prepare; on success one generative_fill row with the request.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeGenerationFixture, BACKGROUND_LAYER, VARIANT } from './generation-fixture'
import { makeComfyFixture } from './comfy-fixture'
import { givePicture } from './cutout-fixture'
import { startComfyStandIn } from '../../helpers/comfy-stand-in'
import { data } from '../core-fixture'
import { vp8x, webp } from '../../fixtures/webp-bytes'
import { greyPng } from '@/main/providers/fake/png'
import { FILL_PROMPT, promptToSend } from '@/shared/generation/prompt'
import type Database from 'better-sqlite3'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

type Fixture = { cleanup(): void; jobs(): JobRow[]; root: string }
let f: Fixture | null = null
afterEach(() => {
  f?.cleanup()
  f = null
})

const BOX = { x: 40, y: 50, width: 600, height: 700 }
const NO_PICTURES: ProviderInfo = {
  id: 'no-pictures',
  label: 'No Pictures',
  jobs: ['cutout'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'none',
  serverText: false,
}

function setGeometry(db: Database.Database, change: Record<string, unknown>): void {
  const geometry = { ...BOX, rotation: 0, crop: null, ...change }
  db.prepare('UPDATE layer SET geometry = ? WHERE id = ?').run(
    JSON.stringify(geometry),
    BACKGROUND_LAYER,
  )
}

const input = (extra: Record<string, unknown> = {}) => ({
  variantId: VARIANT,
  provider: 'fake',
  ...extra,
})

async function fakeFixture(opts: { picture?: boolean; webpToPng?: () => Promise<Uint8Array> }) {
  const g = await makeGenerationFixture(opts.webpToPng ? { webpToPng: opts.webpToPng } : {})
  f = g
  g.core.deps.providers.push(NO_PICTURES)
  setGeometry(g.db, {})
  const sourceId = await g.importPicture('source.png', greyPng(6, 7))
  if (opts.picture ?? true) givePicture(g.db, BACKGROUND_LAYER, sourceId)
  return { g, sourceId }
}

const rule = (reason: string, message: string) => ({
  code: 'RULE_VIOLATION',
  message,
  details: { reason },
})

describe('generation.runFill refusals, in order [A-132, spec/links-and-sync.md]', () => {
  it.each([
    ['an unknown variant', {}, { variantId: 'gone' }, { code: 'NOT_FOUND' }],
    [
      'no background picture',
      { picture: false },
      { provider: 'nope' },
      rule('no_background_picture', 'This variant has no background picture to extend.'),
    ],
    [
      'a turned background',
      { geometry: { rotation: 5 } },
      { provider: 'nope' },
      rule('background_turned', 'Straighten the background before generating a fill.'),
    ],
    [
      'a cropped background',
      { geometry: { crop: { x: 0, y: 0, width: 3, height: 3 } } },
      { provider: 'nope' },
      rule('background_cropped', "Reset the background's crop before generating a fill."),
    ],
    [
      'a background that covers the canvas',
      { geometry: { x: -10, y: 0, width: 1100, height: 1350 } },
      { provider: 'nope' },
      rule('background_covers', 'The background already covers the whole variant.'),
    ],
    [
      'a provider without pictures',
      {},
      { provider: NO_PICTURES.id },
      { code: 'INVALID_INPUT', message: 'That provider cannot make pictures.' },
    ],
    [
      'an unknown provider',
      {},
      { provider: 'nope' },
      { code: 'INVALID_INPUT', message: 'That provider cannot make pictures.' },
    ],
    [
      'a missing key',
      {},
      { provider: 'gemini' },
      { code: 'NEEDS_KEY', message: 'Add your Google Gemini key to generate a fill.' },
    ],
  ] as const)('refuses %s, with no job row', async (_case, setup, extra, error) => {
    const { g } = await fakeFixture({ picture: !('picture' in setup) })
    if ('geometry' in setup) setGeometry(g.db, setup.geometry)
    const r = await g.user('generation.runFill', input(extra))
    expect(r).toEqual({ ok: false, error: expect.objectContaining(error) })
    expect(g.jobs()).toEqual([])
  })

  it('refuses a variant with no background layer as NOT_FOUND', async () => {
    const { g } = await fakeFixture({})
    g.db.prepare('DELETE FROM layer WHERE id = ?').run(BACKGROUND_LAYER)
    const r = await g.user('generation.runFill', input())
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(g.jobs()).toEqual([])
  })

  it('refuses a source whose file is gone with MISSING_FILE, no path in the reply', async () => {
    const { g, sourceId } = await fakeFixture({})
    fs.rmSync(g.asset(sourceId)?.absPath ?? '')
    const r = await g.user('generation.runFill', input())
    expect(r).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'MISSING_FILE', details: { assetIds: [sourceId] } }),
    })
    expect(JSON.stringify(r)).not.toContain(g.root)
    expect(g.jobs()).toEqual([])
  })

  it('refuses a source that is not a picture: asset_not_a_picture', async () => {
    const { g } = await fakeFixture({ picture: false })
    const file = path.join(g.root, 'note.txt')
    fs.writeFileSync(file, 'hello')
    const made = await g.user('asset.import', { paths: [file], library: 'reference', copy: false })
    givePicture(g.db, BACKGROUND_LAYER, data<{ assetIds: string[] }>(made).assetIds[0] ?? '')
    const r = await g.user('generation.runFill', input())
    expect(r).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'asset_not_a_picture' } },
    })
    expect(JSON.stringify(r)).not.toContain(g.root)
    expect(g.jobs()).toEqual([])
  })

  it('takes a WebP background and sends it as PNG through the decoder', async () => {
    const WEBP = webp(vp8x(5, 5, false))
    const webpToPng = vi.fn(async () => greyPng(5, 5))
    const { g } = await fakeFixture({ picture: false, webpToPng })
    givePicture(g.db, BACKGROUND_LAYER, await g.importPicture('photo.webp', WEBP))
    expect(await g.user('generation.runFill', input())).toMatchObject({ ok: true })
    expect(webpToPng).toHaveBeenCalledWith(WEBP)
  })
})

describe('generation.runFill on ComfyUI [spec/links-and-sync.md "Generative fill" step 2]', () => {
  it.each([
    ['no address', true, false, 'comfy_address_needed'],
    ['no offered extend workflow (dev tools off)', false, true, 'comfy_job_not_offered'],
    ['no offered extend workflow (moss-extend is a draft)', true, true, 'comfy_job_not_offered'],
  ])('refuses with %s, no job row, nothing sent', async (_case, devTools, address, reason) => {
    const stand = await startComfyStandIn()
    try {
      const c = await makeComfyFixture({ devTools, ...(address && { origin: stand.origin }) })
      f = c
      setGeometry(c.db, {})
      givePicture(c.db, BACKGROUND_LAYER, await c.importPicture('pics', 'source.png'))
      data(await c.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
      for (const actor of ['user', 'agent'] as const) {
        const r = await c[actor]('generation.runFill', input({ provider: 'comfyui' }))
        expect(r).toEqual({
          ok: false,
          error: expect.objectContaining({ code: 'RULE_VIOLATION', details: { reason } }),
        })
      }
      expect(c.jobs()).toEqual([])
      expect(stand.seen).toEqual([])
    } finally {
      await stand.close()
    }
  })
})

describe('generation.runFill enqueues [spec/links-and-sync.md "Generative fill" step 4]', () => {
  it('one generative_fill row with its targets and the request', async () => {
    const { g, sourceId } = await fakeFixture({})
    const r = await g.user('generation.runFill', input())
    const { jobId } = data<{ jobId: string }>(r)
    expect(r).toEqual({ ok: true, data: { jobId } })
    const job = g.job(jobId)
    expect(job).toMatchObject({
      kind: 'generative_fill',
      campaignId: 'c1',
      variantId: VARIANT,
      layerId: BACKGROUND_LAYER,
      slot: null,
      provider: 'fake',
      startedBy: 'user',
      request: {
        prompt: promptToSend(FILL_PROMPT, { pictures: 1 }),
        sourceAssetId: sourceId,
        placement: BOX,
        width: 1080,
        height: 1350,
      },
    })
    const prompt = (job?.request as { prompt: string }).prompt
    expect(prompt.split('Keep any printing').length).toBe(2)
  })
})
