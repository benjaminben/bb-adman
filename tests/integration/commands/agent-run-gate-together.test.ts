// AR-1 (security class): gate step 3 holds when agent calls arrive together. A run that passed
// the gate but has no job row yet still counts, so the limit cannot be passed by sending calls
// at once (spec/agent-runs.md "Tests that must exist": "Two generate_images calls together
// with limit 1: one jobId, one refusal with the limit sentence").
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { data } from '../core-fixture'

let f: ComfyFixture
let stand: StandIn | undefined
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = undefined
})

const LIMIT_1 =
  "Agents already have 1 runs waiting or running with ComfyUI. That is the limit set in Adman's Settings."

async function ready(limit: number): Promise<void> {
  stand = await startComfyStandIn()
  f = await makeComfyFixture({ devTools: true, origin: stand.origin })
  data(await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
  data(await f.core.bus.execute('agentRuns.setLimit', { limit }, { actor: 'user' }))
}

describe('gate step 3 with agent calls together [spec/agent-runs.md, AR-1]', () => {
  it('with limit 1, two runImages calls together give one job and one refusal', async () => {
    await ready(1)
    const replies = await Promise.all([f.run({}, 'agent'), f.run({}, 'agent')])
    const accepted = replies.filter((r) => (r as { ok: boolean }).ok)
    expect(accepted).toHaveLength(1)
    expect(replies).toContainEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: LIMIT_1 },
    })
    expect(f.jobs()).toHaveLength(1)
  })

  it('frees the place of a run refused after the gate, so the next call is accepted', async () => {
    await ready(1)
    const refused = (await f.run({ variantId: 'no-such-variant' }, 'agent')) as { ok: boolean }
    expect(refused.ok).toBe(false)
    expect(f.jobs()).toHaveLength(0)
    const { jobId } = data<{ jobId: string }>(await f.run({}, 'agent'))
    expect(f.job(jobId)?.startedBy).toBe('agent')
  })
})
