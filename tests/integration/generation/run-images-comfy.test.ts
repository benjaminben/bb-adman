import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'

let f: ComfyFixture
let stand: StandIn | undefined
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = undefined
})

type Refusal = { ok: false; error: { code: string; message: string; details?: unknown } }

// Refused before a job row is made, and nothing reached the server.
async function refused(call: Promise<unknown>): Promise<Refusal['error']> {
  const r = (await call) as Refusal
  expect(r.ok).toBe(false)
  expect(f.jobs()).toEqual([])
  expect(stand?.seen ?? []).toEqual([])
  return r.error
}

async function withAddress(devTools: boolean) {
  stand = await startComfyStandIn()
  f = await makeComfyFixture({ devTools, origin: stand.origin })
}

describe('generation.runImages with provider comfyui [SPEC 4.2, 14 1.41, CU-4]', () => {
  it('with no address saved is refused with comfy_address_needed [FR-255]', async () => {
    f = await makeComfyFixture({ devTools: true })
    expect(await refused(f.run({}))).toEqual({
      code: 'RULE_VIOLATION',
      message: "Enter your ComfyUI server's address to use it.",
      details: { reason: 'comfy_address_needed' },
    })
  })

  it('with the hand-test tools off refuses a trial workflow: comfy_job_not_offered', async () => {
    await withAddress(false)
    expect(await refused(f.run({}))).toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'comfy_job_not_offered' },
    })
  })

  it('with the tools on, the agent is refused with AGENT_DENIED: held as deny until CU-7 [1.57 H-1]', async () => {
    await withAddress(true)
    const error = await refused(f.run({}, 'agent'))
    expect(error.code).toBe('AGENT_DENIED')
  })

  it('with the tools on and the user, a trial workflow is accepted and a job is made', async () => {
    await withAddress(true)
    const r = (await f.run({})) as { ok: boolean }
    expect(r.ok).toBe(true)
    expect(f.jobs()).toHaveLength(1)
  })

  it('refuses two references with too_many_references and details.max 1 [1.46 B]', async () => {
    await withAddress(true)
    const a = await f.importPicture('in', 'a.png')
    const b = await f.importPicture('in', 'b.png')
    expect(await refused(f.run({ referenceAssetIds: [a, b] }))).toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'ComfyUI takes one reference picture for this run.',
      details: { reason: 'too_many_references', max: 1 },
    })
  })
})
