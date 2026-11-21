import { describe, it, expect, afterEach } from 'vitest'
import { makeGenerationFixture, type GenerationFixture } from '../generation/generation-fixture'
import { data } from '../core-fixture'
import { insertCampaign } from '../row-fixtures'
import { insertJob } from './job-row-fixture'
import type { PaidCount } from '@/shared/schemas/queries/paid-count'

let f: GenerationFixture
afterEach(() => f.cleanup())

const query = (campaignId: string, actor: 'user' | 'agent' = 'user') =>
  f.core.query('campaign.paidCount', { projectId: f.projectId, campaignId }, { actor })

// [kind, paid calls, provider]: each kind counts once in its sum.
const RUNS: Array<[string, number, string]> = [
  ['image_generation', 1, 'gemini'],
  ['generative_fill', 2, 'firefly'],
  ['cutout', 4, 'firefly'],
  ['video_generation', 3, 'veo'],
  ['layout_proposal', 5, 'gemini'],
  ['copy_options', 6, 'gemini'],
  ['translation', 7, 'gemini'],
  ['brief_extraction', 100, 'gemini'],
  ['export', 100, 'fake'],
  ['image_generation', 0, 'comfyui'],
  ['cutout', 0, 'comfyui'],
]

describe('campaign.paidCount [spec/ai-jobs.md "The three queries"; FR-230]', () => {
  it('sums paid calls by what the jobs made, for that campaign only', async () => {
    f = await makeGenerationFixture()
    insertCampaign(f.db, 'c2')
    RUNS.forEach(([kind, paidCalls, provider], i) => {
      const createdAt = `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`
      insertJob(f.db, { id: `j${i}`, kind, provider, paidCalls, campaignId: 'c1', createdAt })
      insertJob(f.db, { id: `k${i}`, kind, provider, paidCalls: 50, campaignId: 'c2', createdAt })
    })
    insertJob(f.db, { id: 'no-campaign', paidCalls: 50, createdAt: '2026-01-02T00:00:00Z' })
    for (const actor of ['user', 'agent'] as const) {
      expect(data<PaidCount>(await query('c1', actor))).toEqual({
        pictures: 7,
        videos: 3,
        text: 18,
      })
    }
  })

  it('answers zeros for a campaign with no jobs', async () => {
    f = await makeGenerationFixture()
    insertCampaign(f.db, 'c2')
    insertJob(f.db, { id: 'j', campaignId: 'c1', paidCalls: 2, createdAt: '2026-01-01T00:00:00Z' })
    expect(data<PaidCount>(await query('c2'))).toEqual({ pictures: 0, videos: 0, text: 0 })
  })

  it('gives NOT_FOUND "That campaign was not found." for an unknown campaign', async () => {
    f = await makeGenerationFixture()
    expect(await query('made-up-campaign')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That campaign was not found.' },
    })
  })
})
