// P6-16, from the Phase 5 review: job.retry of a translation job builds the request again from
// the file now (planGroup), as translation.propose would, instead of sending the stored one.
// So a retry translates the master's text now, with the layers' copy counters now.
import { describe, it, expect, afterEach } from 'vitest'
import { setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { TranslationJobRequest } from '@/shared/schemas/jobs/translation'
import { data } from '../core-fixture'
import { makeProposeFixture, waitFor, type ProposeFixture } from './propose-fixture'

let f: ProposeFixture
afterEach(() => f.cleanup())

const NEW_TEXT = 'Fresh from the peaks'

async function failedJob(
  inputOf: (fx: ProposeFixture) => Record<string, unknown>,
): Promise<string> {
  f = await makeProposeFixture()
  const input = inputOf(f)
  setFakeBehaviour({ fail: 'other' })
  const r = await f.user('translation.propose', { provider: 'fake', ...input })
  const [jobId = ''] = data<{ jobIds: string[] }>(r).jobIds
  await waitFor(() => f.ended(jobId))
  expect(f.job(jobId)?.status).toBe('failed')
  setFakeBehaviour({ fail: null })
  return jobId
}

async function retry(jobId: string): Promise<string> {
  const next = data<{ jobId: string }>(await f.user('job.retry', { jobId })).jobId
  await waitFor(() => f.ended(next))
  return next
}

const key = () => f.textKeys[0] ?? ''
const editMaster = async (copy: string) =>
  data(await f.user('layer.update', { layerId: f.masterLayerId(key()), patch: { copy } }))
const requestOf = (jobId: string) => f.job(jobId)?.request as TranslationJobRequest

describe('job.retry of a translation job [P6-16]', () => {
  it("in 'write' mode translates the master's text now and writes it", async () => {
    const old = await failedJob(() => ({ variantIds: ['D1'] }))
    await editMaster(NEW_TEXT)
    const next = await retry(old)
    const request = requestOf(next)
    const master = f.layer(f.masterLayerId(key()))
    expect(request.items.find((i) => i.key === key())).toEqual({
      key: key(),
      text: NEW_TEXT,
      masterCopyRev: master.revs.copy,
    })
    expect(request.targets.map((t) => t.layerId).sort()).toEqual(
      f.textKeys.map((k) => f.id('D1', k)).sort(),
    )
    expect(f.layer(f.id('D1', key())).copy).toBe(`[de] ${NEW_TEXT}`)
  })

  it("in 'sync' mode stays a sync job with the copy counters now", async () => {
    const old = await failedJob((fx) => ({
      mode: 'sync',
      directionId: fx.directionId,
      language: 'de',
    }))
    await editMaster(NEW_TEXT)
    const next = await retry(old)
    const request = requestOf(next)
    expect(request.mode).toBe('sync')
    expect(request.items.find((i) => i.key === key())?.text).toBe(NEW_TEXT)
    const d1 = f.layer(f.id('D1', key()))
    expect(request.targets).toContainEqual({ layerId: d1.id, key: key(), copyRev: d1.revs.copy })
    expect(f.job(next)?.result).toMatchObject({ written: 0 })
  })

  it('refuses nothing_to_translate when the master has no text now, with no new job', async () => {
    const old = await failedJob(() => ({ variantIds: ['D1'] }))
    f.db.prepare("UPDATE layer SET copy = '' WHERE variant_id = ?").run(f.masterId)
    const count = f.jobs().length
    expect(await f.user('job.retry', { jobId: old })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'nothing_to_translate' } },
    })
    expect(f.jobs()).toHaveLength(count)
  })
})
