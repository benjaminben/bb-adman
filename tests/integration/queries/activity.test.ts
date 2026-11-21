import { describe, it, expect, afterEach } from 'vitest'
import {
  makeGenerationFixture,
  TEXT_LAYER,
  VARIANT,
  type GenerationFixture,
} from '../generation/generation-fixture'
import { data } from '../core-fixture'
import { insertJob } from './job-row-fixture'
import type { JobActivity } from '@/shared/schemas/queries/activity'

let f: GenerationFixture
afterEach(() => f.cleanup())

const T = (d: number) => `2026-01-0${d}T00:00:00Z`

async function seeded(): Promise<void> {
  f = await makeGenerationFixture()
  insertJob(f.db, {
    id: 'placed',
    campaignId: 'c1',
    variantId: VARIANT,
    layerId: TEXT_LAYER,
    createdAt: T(1),
  })
  insertJob(f.db, {
    id: 'gone',
    campaignId: 'c-gone',
    variantId: 'v-gone',
    layerId: 'l-gone',
    createdAt: T(2),
  })
  insertJob(f.db, { id: 'brief', kind: 'brief_extraction', createdAt: T(3) })
  insertJob(f.db, { id: 'damaged', request: '{not json', createdAt: T(4) })
}

const query = (input: Record<string, unknown> = {}, actor: 'user' | 'agent' = 'user') =>
  f.core.query('job.activity', { projectId: f.projectId, ...input }, { actor })

describe('job.activity [spec/ai-jobs.md "The three queries"; FR-152, FR-217]', () => {
  it('lists every readable job newest first with the names of where each belongs', async () => {
    await seeded()
    for (const actor of ['user', 'agent'] as const) {
      const reply = data<JobActivity>(await query({}, actor))
      expect(reply.map((a) => [a.job.id, a.place])).toEqual([
        ['brief', { campaignName: null, variantLabel: null, layerName: null }],
        ['gone', { campaignName: null, variantLabel: null, layerName: null }],
        ['placed', { campaignName: 'Summer', variantLabel: 'Master · 4:5 · en', layerName: 'L' }],
      ])
    }
  })

  it('leaves out an unreadable row and keeps the others', async () => {
    await seeded()
    const ids = data<JobActivity>(await query()).map((a) => a.job.id)
    expect(ids).toHaveLength(3)
    expect(ids).not.toContain('damaged')
  })

  it('gives at most limit jobs', async () => {
    await seeded()
    const reply = data<JobActivity>(await query({ limit: 2 }))
    expect(reply.map((a) => a.job.id)).toEqual(['brief', 'gone'])
  })

  it.each([0, 501, 1.5])('refuses limit %s with INVALID_INPUT', async (limit) => {
    await seeded()
    expect(await query({ limit })).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })
})
