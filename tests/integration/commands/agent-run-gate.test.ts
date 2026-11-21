// AR-1 (security class): the gate an agent's picture and video runs pass through the bus,
// with the real handlers, the real core and the ComfyUI stand-in (spec/agent-runs.md "Policy
// and bus", "Gate steps for a run"). Every refusal: AGENT_DENIED, no job row, nothing sent,
// no file read.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { ulid } from 'ulid'
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { data } from '../core-fixture'
import { insertQueued, updateJob } from '@/main/jobs/job-store'
import type { ProjectHandle } from '@/main/db/project-file'
import { createSettingsStore } from '@/main/settings/settings-store'
import { defaultSettings } from '@/main/settings/defaults'
import { agentRunLimitMessage } from '@/main/commands/agent-run-gate'

let f: ComfyFixture
let stand: StandIn | undefined
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = undefined
})

const NOT_TICKED =
  "The user has not allowed agents to start runs with ComfyUI. They can allow it in Adman's Settings."
const video = {
  variantId: 'v1',
  prompt: 'A bottle on a rock',
  durationMs: 2_000,
  provider: 'comfyui',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [],
}

async function ready(opts: { tick?: boolean; limit?: number } = {}): Promise<void> {
  stand = await startComfyStandIn()
  f = await makeComfyFixture({ devTools: true, origin: stand.origin })
  if (opts.tick ?? true)
    data(await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
  if (opts.limit)
    data(await f.core.bus.execute('agentRuns.setLimit', { limit: opts.limit }, { actor: 'user' }))
}

// Refused by the gate: AGENT_DENIED with this sentence, no new job row, no request to the
// stand-in and no picture file read.
async function refusedAtGate(call: () => Promise<unknown>, message: string): Promise<void> {
  const read = vi.spyOn(f.core.deps.assets, 'read')
  const before = f.jobs().length
  expect(await call()).toEqual({ ok: false, error: { code: 'AGENT_DENIED', message } })
  expect(f.jobs()).toHaveLength(before)
  expect(stand?.seen).toEqual([])
  expect(read).not.toHaveBeenCalled()
  read.mockRestore()
}

function seedJob(
  h: ProjectHandle,
  provider: string,
  startedBy: 'agent' | 'user',
  status = 'queued',
) {
  const id = ulid()
  insertQueued(
    h,
    id,
    {
      kind: 'image_generation',
      campaignId: 'c1',
      variantId: 'v1',
      layerId: null,
      slot: 'background',
      provider,
      model: '',
      request: { prompt: 'a', referenceAssetIds: [], count: 1, width: 4, height: 4 },
      startedBy,
    },
    'x',
  )
  if (status !== 'queued') updateJob(h, id, { status: status as 'running' }, 'x')
}

describe('a ticked ComfyUI run as the agent [spec/agent-runs.md "After the gate"]', () => {
  it('generation.runImages is accepted: one job, startedBy agent, seenAt null', async () => {
    await ready()
    const r = await f.run({}, 'agent')
    const { jobId } = data<{ jobId: string }>(r)
    expect(f.jobs()).toHaveLength(1)
    expect(f.job(jobId)).toMatchObject({ startedBy: 'agent', seenAt: null, provider: 'comfyui' })
  })

  it('generation.startVideo is accepted: startedBy agent, seenAt null', async () => {
    await ready()
    const { jobId } = data<{ jobId: string }>(await f.agent('generation.startVideo', video))
    expect(f.job(jobId)).toMatchObject({ startedBy: 'agent', seenAt: null })
  })
})

describe('gate step 1: the provider is offered for agent runs', () => {
  it('refuses an unknown provider ID', async () => {
    await ready()
    await refusedAtGate(
      () => f.run({ provider: 'nope' }, 'agent'),
      'Agents cannot start runs with that provider.',
    )
  })

  it.each([
    ['gemini', 'Google Gemini'],
    ['fal-seedance', 'fal.ai Seedance'],
    ['firefly', 'Adobe Firefly'],
    ['s3', 'Amazon S3'],
  ])('refuses %s, even with a hand-edited tick in settings.json', async (id, label) => {
    await ready()
    const file = path.join(f.core.deps.userDataDir, 'settings.json')
    const written = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
    written.agentRuns = {
      'fal-seedance': { allowed: true },
      gemini: { allowed: true },
      [id]: { allowed: true },
    }
    fs.writeFileSync(file, JSON.stringify(written))
    const reloaded = makeReloaded()
    expect(reloaded.settings.get().agentRuns[id]).toEqual({ allowed: true })
    await refusedAtGate(
      () => f.run({ provider: id }, 'agent'),
      `Agents cannot start runs with ${label}.`,
    )
    await refusedAtGate(
      () => f.agent('generation.startVideo', { ...video, provider: id }),
      `Agents cannot start runs with ${label}.`,
    )
  })
})

// The core's settings store reloads the file now on disk, as at the next start. Its methods
// are swapped in place, so every handler holding deps.settings sees the reloaded store.
function makeReloaded() {
  const store = createSettingsStore({
    file: path.join(f.core.deps.userDataDir, 'settings.json'),
    defaults: defaultSettings(f.root),
  })
  Object.assign(f.core.deps.settings, store)
  return f.core.deps
}

describe('gate step 2: the tick is on, read at each call', () => {
  it('refuses with no tick, before any picture is read', async () => {
    await ready({ tick: false })
    const ref = await f.importPicture('pics', 'shoe.png')
    await refusedAtGate(() => f.run({ referenceAssetIds: [ref] }, 'agent'), NOT_TICKED)
    await refusedAtGate(
      () =>
        f.agent('generation.startVideo', {
          ...video,
          start: 'first_frame',
          referenceAssetIds: [ref],
        }),
      NOT_TICKED,
    )
  })

  it('refuses the next call once the user unticks', async () => {
    await ready()
    data(await f.run({}, 'agent'))
    data(await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: false }))
    await refusedAtGate(() => f.run({}, 'agent'), NOT_TICKED)
  })

  it('leaves the user unticked: the user runs with no tick', async () => {
    await ready({ tick: false })
    expect((await f.run({})) as { ok: boolean }).toMatchObject({ ok: true })
  })
})

describe('gate step 3: the agent run limit per provider, over every open project', () => {
  // AR-2: the sentence holds no number, so an agent learns neither the limit nor the count.
  const limitSentence = (_n: number) =>
    'Agents already have the most runs allowed with ComfyUI. Wait for one to finish.'

  it('exports the limit sentence for other tests to use', () => {
    expect(agentRunLimitMessage('ComfyUI')).toBe(limitSentence(2))
  })

  it('with limit 2, two agent jobs queued or running refuse a third', async () => {
    await ready({ limit: 2 })
    seedJob(f.project, 'comfyui', 'agent')
    seedJob(f.project, 'comfyui', 'agent', 'running')
    await refusedAtGate(() => f.run({}, 'agent'), limitSentence(2))
  })

  it('counts agent jobs in another open project', async () => {
    await ready({ limit: 2 })
    const other = data<{ projectId: string }>(
      await f.core.bus.execute(
        'project.create',
        { name: 'Q', location: f.root },
        { actor: 'user' },
      ),
    )
    seedJob(f.project, 'comfyui', 'agent')
    seedJob(f.core.projects.requireOpen(other.projectId), 'comfyui', 'agent')
    await refusedAtGate(() => f.run({}, 'agent'), limitSentence(2))
  })

  it('does not count user jobs, ended jobs or another provider', async () => {
    await ready({ limit: 2 })
    seedJob(f.project, 'comfyui', 'agent')
    for (let i = 0; i < 3; i++) {
      seedJob(f.project, 'comfyui', 'user')
      seedJob(f.project, 'fake', 'agent')
      seedJob(f.project, 'comfyui', 'agent', 'succeeded')
      seedJob(f.project, 'comfyui', 'agent', 'cancelled')
    }
    const { jobId } = data<{ jobId: string }>(await f.run({}, 'agent'))
    expect(f.job(jobId)?.startedBy).toBe('agent')
  })

  it('never holds back the user', async () => {
    await ready({ limit: 1 })
    seedJob(f.project, 'comfyui', 'agent')
    expect((await f.run({})) as { ok: boolean }).toMatchObject({ ok: true })
  })
})
