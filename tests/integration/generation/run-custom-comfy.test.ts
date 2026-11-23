import fs from 'node:fs'
import { describe, it, expect, afterEach } from 'vitest'
import { greyPng } from '@/main/providers/fake/png'
import { uploadName } from '@/main/providers/comfyui/values'
import { historyEntry, servePicture } from '../../helpers/comfy-run'
import { generationDetailsOf } from '../../fixtures/png-chunks'
import {
  addCustom,
  changedInputs,
  customRunSetUp,
  finishSubmitted,
  jobEnds,
  prompts,
  storedGraph,
  uploads,
  type CustomRun,
} from './custom-run-fixture'

let r: CustomRun
afterEach(() => r.close())

type Reply = { ok: boolean; data?: { jobId: string }; error?: { code: string; details?: unknown } }

const A = greyPng(6, 4)
const B = greyPng(7, 4)

async function twoPictures(): Promise<[string, string]> {
  return [await r.f.importPicture('in', 'a.png', A), await r.f.importPicture('in', 'b.png', B)]
}

describe('generation.runImages with a custom workflow [D-104, CW-3]', () => {
  it('with one picture of two sends the graph without the second loader and its input', async () => {
    r = await customRunSetUp()
    servePicture(r.stand)
    const id = addCustom(r, 'two-refs', 'Two bottles')
    const [a] = await twoPictures()
    const reply = (await r.f.run({ workflowId: id, referenceAssetIds: [a] })) as Reply
    expect(reply.ok).toBe(true)
    await finishSubmitted(r.stand, () => historyEntry('4'))
    expect((await jobEnds(r.f, reply.data?.jobId ?? ''))?.status).toBe('succeeded')
    expect(uploads(r.stand)).toHaveLength(1)
    const [sent] = prompts(r.stand)
    expect(Object.keys(sent?.prompt ?? {}).sort()).toEqual(['1', '3', '4'])
    expect(Object.keys(sent?.prompt['3']?.inputs ?? {}).sort()).toEqual([
      'first',
      'noise_seed',
      'prompt',
    ])
    expect(sent?.prompt['1']?.inputs.image).toBe(`adman/${uploadName(A)}`)
  })

  it('refuses one picture for a workflow that needs both: too_few_references, min 2, no job', async () => {
    r = await customRunSetUp()
    const id = addCustom(r, 'two-refs-both', 'Two bottles')
    const [a] = await twoPictures()
    const reply = (await r.f.run({ workflowId: id, referenceAssetIds: [a] })) as Reply
    expect(reply).toMatchObject({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'This workflow needs 2 reference pictures.',
        details: { reason: 'too_few_references', min: 2 },
      },
    })
    expect(r.f.jobs()).toEqual([])
    expect(prompts(r.stand)).toEqual([])
  })

  it('with two pictures sends the stored graph changed only at its marked inputs', async () => {
    r = await customRunSetUp()
    servePicture(r.stand)
    const id = addCustom(r, 'two-refs', 'Two bottles')
    const pictures = await twoPictures()
    const reply = (await r.f.run({ workflowId: id, referenceAssetIds: pictures })) as Reply
    expect(reply.ok).toBe(true)
    const jobId = reply.data?.jobId ?? ''
    expect(r.f.job(jobId)?.request).toMatchObject({ workflowId: id })
    await finishSubmitted(r.stand, () => historyEntry('4'))
    const job = await jobEnds(r.f, jobId)
    expect(job?.status).toBe('succeeded')

    const names = uploads(r.stand).map(
      (q) => /filename="([^"]+)"/.exec(q.body.toString('latin1'))?.[1],
    )
    expect(names).toEqual([uploadName(A), uploadName(B)])
    const [sent, more] = prompts(r.stand)
    expect(more).toBeUndefined()
    const stored = storedGraph(r, id)
    expect(changedInputs(stored, sent?.prompt ?? {})).toEqual(
      ['1.image', '2.image', '3.noise_seed', '3.prompt'].sort(),
    )
    expect(sent?.prompt['1']?.inputs.image).toBe(`adman/${uploadName(A)}`)
    const seed = sent?.prompt['3']?.inputs.noise_seed as number
    expect(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32).toBe(true)

    const assetId = (job?.result as { assetIds: string[] }).assetIds[0] ?? ''
    const asset = r.f.asset(assetId)
    expect(asset?.genModel).toBe('custom ComfyUI workflow')
    const details = generationDetailsOf(fs.readFileSync(asset?.absPath ?? ''))
    expect(details).toMatchObject({ model: 'custom ComfyUI workflow', models: [] })
    expect(details.workflow).toEqual({ id, version: 1 })
  }, 25_000)

  it('keeps every seed of a custom picture run below 2^32 [D-104]', async () => {
    r = await customRunSetUp()
    servePicture(r.stand)
    const id = addCustom(r, 'picture', 'Lighthouse')
    const reply = (await r.f.run({ workflowId: id })) as Reply
    await finishSubmitted(r.stand, () => historyEntry('9'))
    expect((await jobEnds(r.f, reply.data?.jobId ?? ''))?.status).toBe('succeeded')
    const [sent] = prompts(r.stand)
    const stored = storedGraph(r, id)
    expect(changedInputs(stored, sent?.prompt ?? {})).toEqual(
      ['3.seed', '5.height', '5.width', '6.text'].sort(),
    )
    expect(sent?.prompt['3']?.inputs.seed as number).toBeLessThan(2 ** 32)
  }, 25_000)

  it('needs no licence confirmation for a custom workflow [D-088]', async () => {
    r = await customRunSetUp()
    const off = { licenceConfirmed: [] }
    data(await r.f.core.bus.execute('settings.update', off, { actor: 'user' }))
    const id = addCustom(r, 'picture', 'Lighthouse')
    const reply = (await r.f.run({ workflowId: id })) as Reply
    expect(reply.ok).toBe(true)
  })
})

function data(reply: unknown) {
  expect((reply as Reply).ok).toBe(true)
}
