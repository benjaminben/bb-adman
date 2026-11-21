// S2-4 [D-088] (spec/comfyui-workflows.md "Commercial-licence dialog"): a ComfyUI run whose
// workflow's model needs a commercial licence runs only when the user confirms it in the
// input, or the model's label is saved in settings.licenceConfirmed. For an agent the flag
// is ignored. A refusal comes before any job row and before anything is sent.
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { data } from '../core-fixture'
import { licenceNotConfirmedMessage } from '@/shared/providers/messages'
import type { Actor } from '@/shared/schemas/events'

let f: ComfyFixture
let stand: StandIn
afterEach(async () => {
  f.cleanup()
  await stand.close()
})

const VIDEO = {
  variantId: 'v1',
  prompt: 'A bottle on a rock at dawn',
  durationMs: 2_000,
  provider: 'comfyui',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [],
}

async function ready(): Promise<void> {
  stand = await startComfyStandIn()
  f = await makeComfyFixture({ devTools: true, origin: stand.origin })
}

const app = (name: string, input: Record<string, unknown>) =>
  f.core.bus.execute(name, input, { actor: 'user' })
const save = async (labels: string[]) =>
  data(await app('settings.update', { licenceConfirmed: labels }))
const tick = async () =>
  data(await app('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))

function failedVideo(id: string): void {
  const request = { ...VIDEO, width: 1080, height: 1350, referenceAssetIds: [] }
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, campaign_id, variant_id,
         created_at, updated_at)
       VALUES (?, 'video_generation', 'failed', 'comfyui', '', ?, 'c1', 'v1',
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(id, JSON.stringify(request))
}

type Run = (extra: Record<string, unknown>, actor: Actor) => Promise<unknown>

const RUNS: Array<[string, string, string, () => Promise<Run>]> = [
  [
    'an H3 video',
    'MiniMax H3',
    'h3-text-to-video',
    async () => (extra, actor) => f.core.bus.execute(
      'generation.startVideo',
      { projectId: f.projectId, ...VIDEO, ...extra },
      { actor },
    ),
  ],
  [
    'a FLUX 3 klein picture',
    'FLUX 3 klein',
    'flux3-klein-edit-references',
    async () => {
      const id = await f.importPicture('pics', 'bottle.png')
      return (extra, actor) => f.run({ referenceAssetIds: [id], ...extra }, actor)
    },
  ],
  [
    'job.retry of a failed H3 run',
    'MiniMax H3',
    'h3-text-to-video',
    async () => {
      failedVideo('j-old')
      return (extra, actor) =>
        f.core.bus.execute('job.retry', { projectId: f.projectId, jobId: 'j-old', ...extra }, {
          actor,
        })
    },
  ],
]

async function expectRefused(run: () => Promise<unknown>, label: string, workflow: string) {
  const before = f.jobs().length
  expect(await run()).toEqual({
    ok: false,
    error: {
      code: 'INVALID_INPUT',
      message: licenceNotConfirmedMessage(label),
      details: { reason: 'licence_not_confirmed', workflow },
    },
  })
  expect(f.jobs()).toHaveLength(before)
  expect(stand.seen).toEqual([])
}

async function expectAccepted(run: () => Promise<unknown>) {
  const before = f.jobs().length
  expect(await run()).toMatchObject({ ok: true })
  expect(f.jobs()).toHaveLength(before + 1)
}

describe.each(RUNS)('%s [S2-4, D-088]', (_name, label, workflow, setUp) => {
  it('is refused with no flag: no job row, nothing sent', async () => {
    await ready()
    const run = await setUp()
    await expectRefused(() => run({}, 'user'), label, workflow)
  })

  it('is accepted with the flag from the user', async () => {
    await ready()
    const run = await setUp()
    await expectAccepted(() => run({ licenceConfirmed: true }, 'user'))
  })

  it('is accepted with no flag once the model is saved', async () => {
    await ready()
    const run = await setUp()
    await save(['Another model', label])
    await expectAccepted(() => run({}, 'user'))
  })
})

describe('a run with no licence note [S2-4]', () => {
  it('a MOSS picture with no flag is accepted', async () => {
    await ready()
    await expectAccepted(() => f.run({}, 'user'))
  })
})

describe('an agent run of a workflow that needs a licence [S2-4, D-088]', () => {
  const agentVideo = (extra: Record<string, unknown> = {}) =>
    f.agent('generation.startVideo', { ...VIDEO, ...extra })

  it('is refused with the flag in the input and ComfyUI ticked: the flag is ignored', async () => {
    await ready()
    await tick()
    await expectRefused(
      () => agentVideo({ licenceConfirmed: true }),
      'MiniMax H3',
      'h3-text-to-video',
    )
  })

  it('is accepted after the user saved the model', async () => {
    await ready()
    await tick()
    await save(['MiniMax H3'])
    await expectAccepted(() => agentVideo())
  })
})
