// CW-3 "One owner": for every job and video start, the workflow comfy.getInfo and
// comfyWorkflow.list mark isDefault is the one a run with no workflow named gets. Shared by
// the test on the shipped list and the one on its trial copy. Not a test file.
import { expect } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { serveNeeds } from '../../helpers/comfy-run'
import { data } from '../core-fixture'
import { checked } from './store-fixture'
import { greyPng } from '@/main/providers/fake/png'
import type { CustomFixture } from '../../fixtures/comfy-custom/load'
import type { ComfyWorkflowList } from '@/shared/schemas/queries/comfy-workflow'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import type { Actor } from '@/shared/schemas/events'

const CUSTOM: CustomFixture[] = ['picture', 'two-refs', 'video-prompt', 'video-first-frame', 'video-refs']

type Key = { job: string; start: string | null }
const keyOf = (k: Key) => `${k.job}/${k.start ?? '-'}`

const KEYS: Key[] = [
  { job: 'image', start: null },
  { job: 'image_refs', start: null },
  { job: 'video', start: 'prompt' },
  { job: 'video', start: 'first_frame' },
  { job: 'video', start: 'references' },
]

export type OneOwner = { f: ComfyFixture; stand: StandIn }

async function setUp(devTools: boolean): Promise<OneOwner> {
  const stand = await startComfyStandIn()
  serveNeeds(stand)
  const f = await makeComfyFixture({
    devTools,
    origin: stand.origin,
    fitPicture: (_bytes, run) => greyPng(run.width, run.height),
  })
  data(await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
  data(await f.user('agentRuns.setLimit', { limit: 16 }))
  for (const fixture of CUSTOM) {
    f.core.deps.comfyWorkflows.add({ checked: checked(fixture), name: fixture, addedBy: 'user' })
  }
  return { f, stand }
}

// The ID a run with no workflow named was given, from its job row.
// The two-reference custom fixture takes two pictures; every other one fitting a key takes one.
async function ranWith(o: OneOwner, key: Key, actor: Actor, pictures: string[], marked: string) {
  const { f } = o
  const before = new Set(f.jobs().map((j) => j.id))
  const refs = (n: number) => pictures.slice(0, n)
  const pair = marked.startsWith('custom-') ? 2 : 1
  const send = actor === 'agent' ? f.agent : f.user
  const reply =
    key.job === 'video'
      ? await send('generation.startVideo', {
          variantId: 'v1',
          prompt: 'A bottle on a rock',
          durationMs: 2_000,
          provider: 'comfyui',
          start: key.start === 'first_frame' ? 'first_frame' : 'none',
          useReferences: key.start === 'references',
          referenceAssetIds: key.start === 'prompt' ? [] : refs(1),
        })
      : await f.run({ referenceAssetIds: key.job === 'image' ? [] : refs(pair) }, actor)
  data(reply)
  const job = f.jobs().find((j) => !before.has(j.id))
  return (job?.request as { workflowId?: string } | undefined)?.workflowId ?? 'none'
}

export async function provesOneOwner(devTools: boolean, actor: Actor): Promise<OneOwner> {
  const o = await setUp(devTools)
  const { f } = o
  const listed = data<ComfyWorkflowList>(
    await f.core.query('comfyWorkflow.list', {}, { actor }),
  ).workflows
  const defaults = new Map(listed.filter((w) => w.isDefault).map((w) => [keyOf(w), w.id]))
  if (actor === 'user') {
    const info = data<ComfyInfo>(await f.core.query('comfy.getInfo', {}, { actor })).workflows
    const shown = info
      .filter((w) => w.isDefault && (w.job === 'image' || w.job === 'image_refs' || w.job === 'video'))
      .map((w) => w.id)
    expect(new Set(shown)).toEqual(new Set(defaults.values()))
  }
  const pictures = [
    await f.importPicture('in', 'a.png', greyPng(6, 4)),
    await f.importPicture('in', 'b.png', greyPng(7, 4)),
  ]
  for (const key of KEYS) {
    const marked = defaults.get(keyOf(key)) ?? 'none marked'
    expect(await ranWith(o, key, actor, pictures, marked), keyOf(key)).toBe(marked)
  }
  return o
}
