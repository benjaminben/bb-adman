// SP-9 [A-127]: job.retry stores the prompt with the one ending its pictures call for, so a
// row made before the two-ending rule is retried with the ending it is sent with.
import { describe, it, expect, afterEach } from 'vitest'
import { makeRunnerFixture, type RunnerFixture } from '../jobs/runner-fixture'
import { KEEP_PRINTING_ENDING, NO_TEXT_ENDING } from '@/shared/generation/prompt'

let x: RunnerFixture
afterEach(() => x.cleanup())

const OLD_PROMPT = `A bottle on a rock ${NO_TEXT_ENDING}`
const picture = (referenceAssetIds: string[]) => ({
  prompt: OLD_PROMPT,
  referenceAssetIds,
  count: 2,
  width: 1080,
  height: 1350,
})
const firstFrameVideo = {
  prompt: OLD_PROMPT,
  durationMs: 2_000,
  width: 1080,
  height: 1920,
  start: 'first_frame',
  referenceAssetIds: ['a1'],
}

// A failed row of the given kind, as a run before SP-9 would have left it.
function failedRow(kind: string, request: unknown): void {
  x = makeRunnerFixture()
  x.project.db
    .prepare(
      `INSERT INTO job (id, kind, status, campaign_id, variant_id, slot, provider, model, request,
        paid_calls, started_by, created_at, updated_at)
       VALUES ('old', ?, 'failed', 'c1', 'v1', NULL, 'fake', 'm1', ?, 0, 'user', 'x', 'x')`,
    )
    .run(kind, JSON.stringify(request))
}

async function retriedRequest(): Promise<Record<string, unknown>> {
  const r = await x.user('job.retry', { projectId: x.projectId, jobId: 'old' })
  if (!r.ok) throw new Error(`retry failed: ${JSON.stringify(r.error)}`)
  return x.row((r.data as { jobId: string }).jobId)?.request as Record<string, unknown>
}

describe('job.retry stores the ending the pictures call for [SP-9; A-127]', () => {
  it.each([
    ['a picture row with one reference', 'image_generation', picture(['a1'])],
    ['a first-frame video row', 'video_generation', firstFrameVideo],
  ])('%s: the new prompt ends in "keep printing" once', async (_, kind, request) => {
    failedRow(kind, request)
    const retried = await retriedRequest()
    const prompt = retried.prompt as string
    expect(prompt).toBe(`A bottle on a rock ${KEEP_PRINTING_ENDING}`)
    expect(prompt.split(KEEP_PRINTING_ENDING)).toHaveLength(2)
    expect(prompt).not.toContain(NO_TEXT_ENDING)
  })

  it.each([
    ['a picture row with one reference', 'image_generation', picture(['a1'])],
    ['a first-frame video row', 'video_generation', firstFrameVideo],
  ])('%s: no other request field changes', async (_, kind, request) => {
    failedRow(kind, request)
    const retried = await retriedRequest()
    expect({ ...retried, prompt: OLD_PROMPT }).toEqual(request)
  })

  it('a picture row with no reference keeps its prompt exactly', async () => {
    failedRow('image_generation', picture([]))
    expect(await retriedRequest()).toEqual(picture([]))
  })

  it('leaves the old row unchanged', async () => {
    failedRow('image_generation', picture(['a1']))
    const before = x.row('old')
    await retriedRequest()
    expect(x.row('old')).toEqual(before)
  })
})
