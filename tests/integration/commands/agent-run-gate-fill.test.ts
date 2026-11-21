// P5-8 (security class): generation.runFill from an agent takes the gate's three steps, as
// generation.runImages does (spec/agent-runs.md "Gate steps for a run"; D-080). A refused
// agent leaves no job row; a user's runs are never counted against the agent limit.
import { describe, it, expect, afterEach } from 'vitest'
import { ulid } from 'ulid'
import {
  makeGenerationFixture,
  BACKGROUND_LAYER,
  OTHER_VARIANT,
  VARIANT,
  type GenerationFixture,
} from '../generation/generation-fixture'
import { givePicture } from '../generation/cutout-fixture'
import { data } from '../core-fixture'
import { insertQueued } from '@/main/jobs/job-store'
import { agentRunLimitMessage } from '@/main/commands/agent-run-gate'

let f: GenerationFixture
afterEach(() => f.cleanup())

const NOT_TICKED =
  "The user has not allowed agents to start runs with Fake provider. They can allow it in Adman's Settings."
const denied = (message: string) => ({ ok: false, error: { code: 'AGENT_DENIED', message } })

async function ready(opts: { tick?: boolean; limit?: number } = {}) {
  f = await makeGenerationFixture()
  f.db
    .prepare('UPDATE layer SET geometry = ? WHERE id = ?')
    .run(
      JSON.stringify({ x: 0, y: 0, width: 500, height: 500, rotation: 0, crop: null }),
      BACKGROUND_LAYER,
    )
  f.db.prepare('UPDATE direction SET master_variant_id = ?').run(OTHER_VARIANT)
  givePicture(f.db, BACKGROUND_LAYER, await f.importPicture('source.png'))
  if (opts.tick ?? true) {
    data(await f.user('agentRuns.setAllowed', { provider: 'fake', allowed: true }))
  }
  if (opts.limit) data(await f.user('agentRuns.setLimit', { limit: opts.limit }))
}

const fill = (actor: 'user' | 'agent') =>
  f.core.bus.execute(
    'generation.runFill',
    { projectId: f.projectId, variantId: VARIANT, provider: 'fake' },
    { actor },
  )

// A queued fake job, as a run that has not ended would leave it.
function seedJob(startedBy: 'user' | 'agent'): void {
  insertQueued(
    f.project,
    ulid(),
    {
      kind: 'image_generation',
      campaignId: null,
      variantId: null,
      layerId: null,
      slot: null,
      provider: 'fake',
      model: '',
      request: { prompt: 'a', referenceAssetIds: [], count: 1, width: 4, height: 4 },
      startedBy,
    },
    'x',
  )
}

describe('generation.runFill and the agent run gate [P5-8; spec/agent-runs.md]', () => {
  it('refuses an agent while the provider is not ticked, with the gate sentence, no job row', async () => {
    await ready({ tick: false })
    expect(await fill('agent')).toEqual(denied(NOT_TICKED))
    expect(f.jobs()).toEqual([])
  })

  it('refuses an agent naming a provider the gate does not know, no job row', async () => {
    await ready()
    const r = await f.core.bus.execute(
      'generation.runFill',
      { projectId: f.projectId, variantId: VARIANT, provider: 'nope' },
      { actor: 'agent' },
    )
    expect(r).toEqual(denied('Agents cannot start runs with that provider.'))
    expect(f.jobs()).toEqual([])
  })

  it('passes a ticked agent: the job has started_by agent and seen_at null', async () => {
    await ready()
    const { jobId } = data<{ jobId: string }>(await fill('agent'))
    expect(f.job(jobId)).toMatchObject({
      kind: 'generative_fill',
      startedBy: 'agent',
      seenAt: null,
    })
  })

  it('refuses an agent at the limit, with the sentence that holds no number', async () => {
    await ready({ limit: 1 })
    seedJob('agent')
    expect(await fill('agent')).toEqual(denied(agentRunLimitMessage('Fake provider')))
    expect(f.jobs()).toHaveLength(1)
  })

  it("does not count a user's runs against the agent, nor hold the user back", async () => {
    await ready({ limit: 1 })
    seedJob('user')
    seedJob('user')
    expect(await fill('agent')).toMatchObject({ ok: true })
    expect(await fill('user')).toMatchObject({ ok: true })
    expect(f.jobs().filter((j) => j.kind === 'generative_fill')).toHaveLength(2)
  })
})
