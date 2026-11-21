// P4-1 (security class): the agent rows of the Phase 4 commands, through the real bus and core
// (spec/ai-jobs.md "Commands, queries and agent rows"; spec/agent-runs.md "Gate steps for a
// run"). A ticked call passes the gate and reaches the command, which refuses: P4-1's stubs
// refuse every call, and the built commands refuse the made-up variant, layer and file used
// here. So these cases hold once the slices replace the stubs. No refusal leaves a job row.
import { describe, it, expect, afterEach } from 'vitest'
import { ulid } from 'ulid'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { insertQueued } from '@/main/jobs/job-store'
import { readWireRows } from '@/main/db/rows'
import { agentRunLimitMessage } from '@/main/commands/agent-run-gate'
import { denialMessage } from '@/main/commands/agent-policy'

let f: Fixture
afterEach(() => f.cleanup())

// Refused by the command itself, not by the gate or the policy.
const PAST_GATE = {
  ok: false,
  error: expect.objectContaining({ code: expect.not.stringMatching(/^AGENT_DENIED$/) }),
}
const NOT_TICKED =
  "The user has not allowed agents to start runs with Fake provider. They can allow it in Adman's Settings."

const RUNS: Array<[string, Record<string, unknown>]> = [
  ['generation.proposeLayout', { variantId: 'v1' }],
  ['generation.copyOptions', { variantId: 'v1', layerId: 'l1', count: 3 }],
  ['generation.cutOut', { variantId: 'v1', layerId: 'l1' }],
]

async function ready(opts: { tick?: boolean; limit?: number } = {}): Promise<string> {
  f = makeFixture({ env: { ADMAN_FAKE_PROVIDERS: '1' } })
  const created = await f.user('project.create', { name: 'P', location: f.projectsDir })
  const { projectId } = data<{ projectId: string }>(created)
  if (opts.tick ?? true)
    data(await f.user('agentRuns.setAllowed', { provider: 'fake', allowed: true }))
  if (opts.limit) data(await f.user('agentRuns.setLimit', { limit: opts.limit }))
  return projectId
}

function jobCount(projectId: string): number {
  return readWireRows(f.core.projects.requireOpen(projectId).db, 'job').length
}

function seedAgentJob(projectId: string): void {
  insertQueued(
    f.core.projects.requireOpen(projectId),
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
      startedBy: 'agent',
    },
    'x',
  )
}

const denied = (message: string) => ({ ok: false, error: { code: 'AGENT_DENIED', message } })

describe.each(RUNS)('%s as the agent [P4-1]', (name, input) => {
  const call = (projectId: string, provider: string) =>
    f.agent(name, { projectId, ...input, provider })

  it.each([
    ['an unknown provider', 'nope', true, 'Agents cannot start runs with that provider.'],
    [
      'a provider not offered for agent runs',
      's3',
      true,
      'Agents cannot start runs with Amazon S3.',
    ],
    ['the tick off', 'fake', false, NOT_TICKED],
  ])('is refused at the gate for %s, with no job row', async (_case, provider, tick, message) => {
    const projectId = await ready({ tick })
    expect(await call(projectId, provider)).toEqual(denied(message))
    expect(jobCount(projectId)).toBe(0)
  })

  it('is refused at the gate when the agent run limit is reached', async () => {
    const projectId = await ready({ limit: 1 })
    seedAgentJob(projectId)
    expect(await call(projectId, 'fake')).toEqual(denied(agentRunLimitMessage('Fake provider')))
    expect(jobCount(projectId)).toBe(1)
  })

  it('ticked, passes the gate and reaches the command, with no job row', async () => {
    const projectId = await ready({ limit: 1 })
    expect(await call(projectId, 'fake')).toEqual(PAST_GATE)
    // The gate's hold was released, so the limit of 1 does not refuse the next call.
    expect(await call(projectId, 'fake')).toEqual(PAST_GATE)
    expect(jobCount(projectId)).toBe(0)
  })

  it('is refused without a provider, so the default provider is never used', async () => {
    const projectId = await ready()
    expect(await f.agent(name, { projectId, ...input })).toMatchObject({ ok: false })
    expect(jobCount(projectId)).toBe(0)
  })
})

describe('the other Phase 4 rows as the agent [P4-1]', () => {
  it('brief.extract is denied: agents cannot read brief files', async () => {
    const projectId = await ready()
    const r = await f.agent('brief.extract', {
      projectId,
      filePath: '/briefs/spring.md',
      provider: 'fake',
    })
    expect(r).toEqual(denied(denialMessage('brief.extract')))
    expect(denialMessage('brief.extract')).toBe(
      'Agents cannot read brief files in this version. Ask the user to do it in the app.',
    )
  })

  it('layer.updateMany passes the deny check and reaches the command', async () => {
    const projectId = await ready({ tick: false })
    const r = await f.agent('layer.updateMany', {
      projectId,
      variantId: 'v1',
      updates: [{ layerId: 'l1', patch: { visible: false } }],
    })
    expect(r).toEqual(PAST_GATE)
  })

  it('the user reaches each command too, with no job row', async () => {
    const projectId = await ready({ tick: false })
    for (const [name, input] of RUNS) {
      expect(await f.user(name, { projectId, ...input, provider: 'fake' })).toEqual(PAST_GATE)
    }
    const brief = { projectId, filePath: '/briefs/spring.md', provider: 'fake' }
    expect(await f.user('brief.extract', brief)).toEqual(PAST_GATE)
    expect(jobCount(projectId)).toBe(0)
  })
})
