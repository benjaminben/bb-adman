import { describe, it, expect, afterEach } from 'vitest'
import {
  makeGenerationFixture,
  BACKGROUND_LAYER,
  TEXT_LAYER,
  VARIANT,
  OTHER_VARIANT,
  type GenerationFixture,
} from '../generation/generation-fixture'
import { data } from '../core-fixture'
import { insertAsset } from '../row-fixtures'
import { insertJob } from './job-row-fixture'
import type { EarlierOptions } from '@/shared/schemas/queries/earlier-options'

let f: GenerationFixture
afterEach(() => f.cleanup())

const query = (layerId: string, actor: 'user' | 'agent' = 'user') =>
  f.core.query('job.earlierOptions', { projectId: f.projectId, layerId }, { actor })

describe('job.earlierOptions [spec/ai-jobs.md "The three queries"; FR-248, FR-216]', () => {
  it('lists the runs of the layer and of its slot in its own variant, newest first', async () => {
    f = await makeGenerationFixture()
    const present = await f.importPicture()
    insertAsset(f.db, { id: 'a-missing' })
    f.db.prepare(`UPDATE asset SET width = 7, height = 8 WHERE id = 'a-missing'`).run()
    const T = (d: number) => `2026-01-0${d}T00:00:00Z`
    const seeds = [
      { id: 'by-layer', layerId: BACKGROUND_LAYER, createdAt: T(1) },
      { id: 'failed', status: 'failed', layerId: BACKGROUND_LAYER, createdAt: T(2) },
      { id: 'cut-slot', kind: 'cutout', variantId: VARIANT, slot: 'background', createdAt: T(3) },
      { id: 'running', status: 'running', layerId: BACKGROUND_LAYER, createdAt: T(4) },
      { id: 'other-variant', variantId: OTHER_VARIANT, slot: 'background', createdAt: T(5) },
      { id: 'other-layer', layerId: TEXT_LAYER, createdAt: T(6) },
      { id: 'layout', kind: 'layout_proposal', layerId: BACKGROUND_LAYER, createdAt: T(7) },
    ]
    const results: Record<string, unknown> = {
      'by-layer': { assetIds: [present, 'a-gone', 'a-missing'] },
      failed: { assetIds: [present] },
      'cut-slot': { assetIds: [present] },
    }
    for (const s of seeds) insertJob(f.db, { ...s, result: results[s.id] })

    for (const actor of ['user', 'agent'] as const) {
      const reply = data<EarlierOptions>(await query(BACKGROUND_LAYER, actor))
      expect(reply.map((o) => o.job.id)).toEqual(['running', 'cut-slot', 'failed', 'by-layer'])
      expect(reply[0]?.assets).toEqual([])
      expect(reply[1]?.job.kind).toBe('cutout')
      expect(reply[3]?.assets).toEqual([
        { assetId: present, width: 5, height: 5, missing: false },
        { assetId: 'a-missing', width: 7, height: 8, missing: true },
      ])
    }
  })

  it('lists at most 50 runs', async () => {
    f = await makeGenerationFixture()
    for (let i = 0; i < 55; i++) {
      const n = String(i).padStart(2, '0')
      insertJob(f.db, {
        id: `j${n}`,
        layerId: BACKGROUND_LAYER,
        createdAt: `2026-01-01T00:00:${n}Z`,
      })
    }
    const reply = data<EarlierOptions>(await query(BACKGROUND_LAYER))
    expect(reply).toHaveLength(50)
    expect(reply[0]?.job.id).toBe('j54')
  })

  it('gives NOT_FOUND "That layer was not found." for an unknown layer', async () => {
    f = await makeGenerationFixture()
    expect(await query('made-up-layer')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That layer was not found.' },
    })
  })
})
