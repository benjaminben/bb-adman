// CW-3: a ComfyUI run of a custom workflow through the real core, against the stand-in. The
// slice H project, the stand-in's address saved, the check answered. Not a test file. Nothing
// here contacts a real server.
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { waitFor } from './generation-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { finishRun, serveNeeds } from '../../helpers/comfy-run'
import { checked } from '../comfy-workflows/store-fixture'
import type { CustomFixture } from '../../fixtures/comfy-custom/load'
import type { Graph } from '@/main/providers/comfyui/workflows/types'
import type { Size } from '@/shared/comfy/fit-size'

export const RUN_MS = 15_000

export type CustomRun = { f: ComfyFixture; stand: StandIn; close(): Promise<void> }

export async function customRunSetUp(
  opts: { devTools?: boolean; fitPicture?: (bytes: Uint8Array, size: Size) => Uint8Array } = {},
): Promise<CustomRun> {
  const stand = await startComfyStandIn()
  serveNeeds(stand)
  const f = await makeComfyFixture({
    devTools: opts.devTools ?? false,
    origin: stand.origin,
    ...(opts.fitPicture && { fitPicture: opts.fitPicture }),
  })
  return {
    f,
    stand,
    async close() {
      f.cleanup()
      await stand.close()
    },
  }
}

export function addCustom(r: CustomRun, fixture: CustomFixture, name: string): string {
  return r.f.core.deps.comfyWorkflows.add({ checked: checked(fixture), name, addedBy: 'user' })
    .stored.id
}

export const storedGraph = (r: CustomRun, id: string): Graph => {
  const entry = r.f.core.deps.comfyWorkflows.get(id)
  if (!entry) throw new Error('no such workflow')
  return entry.stored.graph
}

export const prompts = (stand: StandIn) =>
  stand.seen
    .filter((q) => q.method === 'POST' && q.path === '/prompt')
    .map((q) => JSON.parse(q.body.toString('utf8')) as { prompt_id: string; prompt: Graph })

export const uploads = (stand: StandIn) => stand.seen.filter((q) => q.path === '/upload/image')

// Answers the history of the n-th run the stand-in was sent with a finished entry.
export async function finishSubmitted(
  stand: StandIn,
  entry: (promptId: string) => unknown,
  n = 1,
): Promise<string> {
  await waitFor(() => prompts(stand).length >= n, RUN_MS)
  const sent = prompts(stand)[n - 1]
  if (!sent) throw new Error('nothing submitted')
  finishRun(stand, sent.prompt_id, entry(sent.prompt_id))
  return sent.prompt_id
}

export async function jobEnds(f: ComfyFixture, jobId: string) {
  const ended = () => ['succeeded', 'failed', 'cancelled'].includes(f.job(jobId)?.status ?? '')
  await waitFor(ended, RUN_MS)
  return f.job(jobId)
}

// Each node and input where two graphs differ, as "node.input".
export function changedInputs(before: Graph, after: Graph): string[] {
  const changed: string[] = []
  for (const [id, node] of Object.entries(before)) {
    const other = after[id]
    if (!other || other.class_type !== node.class_type) changed.push(id)
    const names = new Set([...Object.keys(node.inputs), ...Object.keys(other?.inputs ?? {})])
    for (const name of names) {
      const a = JSON.stringify(node.inputs[name])
      const b = JSON.stringify(other?.inputs[name])
      if (a !== b) changed.push(`${id}.${name}`)
    }
  }
  return changed.sort()
}
