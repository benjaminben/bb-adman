// P7-15 (A-174): the quit question names the started paid video runs quitting leaves running,
// read from the open projects' job rows: the rows leftRunningOnClose is true for, counted by
// provider label. A waiting run, a run with no remote ID and a local provider's run are not.
import { describe, it, expect, afterEach } from 'vitest'
import { makeGenerationFixture, type GenerationFixture } from '../generation/generation-fixture'
import { leftRunningList } from '@/main/jobs/left-running-list'
import { quitQuestion } from '@/main/quit-question'

let f: GenerationFixture
afterEach(() => f.cleanup())

let n = 0
function row(provider: string, remote: string | null, stage: string, status = 'running') {
  n += 1
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, remote_job_id, result,
         campaign_id, variant_id, created_at, updated_at)
       VALUES (?, 'video_generation', ?, ?, '', '{}', ?, ?, 'c1', 'v1',
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(`j${n}`, status, provider, remote, JSON.stringify({ stage }))
}

const list = () => leftRunningList(f.core.projects.all(), f.core.deps.providers, f.core.log)

describe('leftRunningList, for the quit question [P7-15, A-174]', () => {
  it('counts only started fal runs that are working', async () => {
    f = await makeGenerationFixture()
    row('fal-seedance', 'r1', 'working')
    row('fal-seedance', 'r2', 'waiting')
    row('fal-seedance', null, 'working')
    row('fal-seedance', 'r3', 'working', 'queued')
    row('fake', 'r4', 'working')
    row('comfyui', 'r5', 'working')
    expect(list()).toEqual([{ label: 'fal.ai Seedance', count: 1 }])
  })

  it('gives nothing when no run would be left', async () => {
    f = await makeGenerationFixture()
    row('fal-seedance', 'r1', 'waiting')
    expect(list()).toEqual([])
  })

  it.each([
    [
      1,
      'fal.ai Seedance has started 1 video and will charge for it. It keeps running; open the project again to collect it.',
    ],
    [
      2,
      'fal.ai Seedance has started 2 videos and will charge for them. They keep running; open the project again to collect them.',
    ],
  ])('with %i such runs, the quit question names them', async (count, sentence) => {
    f = await makeGenerationFixture()
    for (let i = 0; i < count; i++) row('fal-seedance', `r${i}`, 'working')
    const question = quitQuestion(count, list())
    expect(question?.detail.endsWith(` ${sentence}`)).toBe(true)
  })
})
