import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { greyPng } from '@/main/providers/fake/png'

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

  it('with the tools on and ComfyUI ticked by the user, the agent is accepted [AR-1]', async () => {
    await withAddress(true)
    await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true })
    const r = (await f.run({}, 'agent')) as { ok: boolean }
    expect(r.ok).toBe(true)
    expect(f.jobs()).toHaveLength(1)
    expect(f.jobs()[0]).toMatchObject({ startedBy: 'agent', seenAt: null })
  })

  it('with the tools on and no tick, the agent is refused at gate step 2 [AR-1]', async () => {
    await withAddress(true)
    expect(await refused(f.run({}, 'agent'))).toEqual({
      code: 'AGENT_DENIED',
      message:
        "The user has not allowed agents to start runs with ComfyUI. They can allow it in Adman's Settings.",
    })
  })

  it('with the tools off and ComfyUI ticked, the agent gets comfy_job_not_offered [AR-1]', async () => {
    await withAddress(false)
    await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true })
    expect(await refused(f.run({}, 'agent'))).toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'comfy_job_not_offered' },
    })
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
    const b = await f.importPicture('in', 'b.png', greyPng(7, 4))
    expect(await refused(f.run({ referenceAssetIds: [a, b] }))).toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'ComfyUI takes one reference picture for this run.',
      details: { reason: 'too_many_references', max: 1 },
    })
  })
})
