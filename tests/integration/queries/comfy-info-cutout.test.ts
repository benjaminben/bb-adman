// P4-9 (spec/ai-jobs.md "Cut-out"): birefnet-cutout is proven [D-103], so comfy.getInfo marks
// it offered with the hand-test tools on or off.
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { data } from '../core-fixture'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'

let f: ComfyFixture
afterEach(() => f.cleanup())

async function cutout(devTools: boolean) {
  f = await makeComfyFixture({ devTools })
  const info = data<ComfyInfo>(await f.core.query('comfy.getInfo', {}, { actor: 'user' }))
  return info.workflows.find((w) => w.id === 'birefnet-cutout')
}

describe('comfy.getInfo and the cut-out workflow [P4-9]', () => {
  it.each([
    [true, true],
    [false, true],
  ])('with the hand-test tools %s, marks birefnet-cutout offered: %s', async (tools, offered) => {
    expect(await cutout(tools)).toMatchObject({
      job: 'cutout',
      status: 'proven',
      offered,
      licence: { name: 'MIT', commercialNote: null },
    })
  })
})
