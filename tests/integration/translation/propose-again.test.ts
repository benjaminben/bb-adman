// P6-17, workflow 5.2's failed translation and its "Retry" (spec/phases/phase-06.md, design
// addition 8): the translation panel's Retry is a new translation.propose, not job.retry. Here
// the fake fails one German propose; the layers stay missing and the newest German job reads
// as failed (what the panel shows "Retry" for); a second propose with the fake working writes
// the fake's text, proposed, from AI, and the newest job reads as succeeded.
import { describe, it, expect, afterEach } from 'vitest'
import { setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { TranslationForCampaign } from '@/shared/schemas/queries/translation'
import { data } from '../core-fixture'
import { makeProposeFixture, waitFor, type ProposeFixture } from './propose-fixture'

let f: ProposeFixture
afterEach(() => f.cleanup())

async function propose(): Promise<string> {
  const input = { provider: 'fake', variantIds: ['D1'] }
  const [jobId = ''] = data<{ jobIds: string[] }>(await f.user('translation.propose', input)).jobIds
  await waitFor(() => f.ended(jobId))
  return jobId
}

async function newestGermanJob() {
  const input = { projectId: f.projectId, campaignId: f.campaignId }
  const read = data<TranslationForCampaign>(
    await f.core.query('translation.forCampaign', input, { actor: 'user' }),
  )
  return read.jobs.find((j) => j.directionId === f.directionId && j.language === 'de')
}

describe('a failed translation, then the panel Retry [P6-17, workflow 5.2]', () => {
  it('a new propose after a failed one writes the translation as proposed, from AI', async () => {
    f = await makeProposeFixture()
    const key = f.textKeys[0] ?? ''
    const master = f.layer(f.masterLayerId(key)).copy ?? ''

    setFakeBehaviour({ fail: 'other' })
    const failed = await propose()
    expect(f.job(failed)?.status).toBe('failed')
    expect(await newestGermanJob()).toMatchObject({ jobId: failed, status: 'failed' })
    expect(f.layer(f.id('D1', key)).translationStatus).toBe('missing')

    setFakeBehaviour({ fail: null })
    const next = await propose()
    expect(next).not.toBe(failed)
    expect(f.job(next)?.status).toBe('succeeded')
    expect(await newestGermanJob()).toMatchObject({ jobId: next, status: 'succeeded' })
    const written = f.layer(f.id('D1', key))
    expect(written.copy).toBe(`[de] ${master}`)
    expect(written.translationStatus).toBe('proposed')
    expect(written.translationSource).toBe('ai')
  })
})
