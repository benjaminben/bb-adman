// MCP-G: a door over the real core for the start and cancel tools. The slice H project (seed),
// dev tools on, the ComfyUI stand-in's address saved, ComfyUI ticked by the user unless asked
// otherwise, MCP on and one tool session. Not a test file. Nothing here contacts a real server.
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { waitFor } from '../generation/generation-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { finishRun, serveNeeds } from '../../helpers/comfy-run'
import { data } from '../core-fixture'
import { freePort } from './http-client'
import { replyJson, toolSession, type ToolReply, type ToolSession } from './tool-client'
import type { Size } from '@/shared/comfy/fit-size'

export type RunSetUp = {
  f: ComfyFixture
  stand: StandIn
  s: ToolSession
  projectId: string
  close(): Promise<void>
}

export const RUN_MS = 15_000

// The step 2 sentence of the gate (spec/agent-runs.md, "Gate steps for a run").
export const NOT_TICKED =
  "The user has not allowed agents to start runs with ComfyUI. They can allow it in Adman's Settings."

const user = (f: ComfyFixture, name: string, input: unknown) =>
  f.core.bus.execute(name, input, { actor: 'user' })

export async function runSetUp(
  opts: { ticked?: boolean; fitPicture?: (bytes: Uint8Array, size: Size) => Uint8Array } = {},
): Promise<RunSetUp> {
  const stand = await startComfyStandIn()
  serveNeeds(stand)
  const f = await makeComfyFixture({
    devTools: true,
    origin: stand.origin,
    ...(opts.fitPicture && { fitPicture: opts.fitPicture }),
  })
  if (opts.ticked !== false) {
    data(await user(f, 'agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
  }
  data(await user(f, 'settings.update', { mcp: { port: await freePort() } }))
  data(await user(f, 'mcp.setEnabled', { enabled: true }))
  const token = f.core.secrets.get('mcp.token')
  if (!token) throw new Error('no token has been made')
  const s = await toolSession(f.core.settings.get().mcp.port, token)
  return {
    f,
    stand,
    s,
    projectId: f.projectId,
    async close() {
      await f.core.mcp.stop()
      f.cleanup()
      await stand.close()
    },
  }
}

// generate_images' arguments for the master variant's background slot.
export function imageArgs(r: RunSetUp, extra: Record<string, unknown> = {}) {
  return {
    project_id: r.projectId,
    variant_id: 'v1',
    slot: 'background',
    prompt: 'A bottle on a rock',
    reference_asset_ids: [],
    count: 1,
    provider: 'comfyui',
    ...extra,
  }
}

export type JobView = { id: string; status: string; assetIds: string[]; startedBy: string }

export async function getJob(r: RunSetUp, jobId: string): Promise<JobView> {
  return replyJson<JobView>(await r.s.call('get_job', { project_id: r.projectId, job_id: jobId }))
}

// Polls get_job, as an agent would, until the run shows one of the given states.
export async function jobReaches(r: RunSetUp, jobId: string, states: string[]) {
  let view = await getJob(r, jobId)
  const end = Date.now() + RUN_MS
  while (!states.includes(view.status)) {
    if (Date.now() > end) throw new Error(`job ${jobId} stayed ${view.status}`)
    await new Promise((done) => setTimeout(done, 50))
    view = await getJob(r, jobId)
  }
  return view
}

// Answers the history of the run the stand-in was sent with a finished entry.
export async function finishWhenSubmitted(r: RunSetUp, entry: (promptId: string) => unknown) {
  const submitted = () => r.stand.seen.find((q) => q.path === '/prompt')
  await waitFor(() => submitted() !== undefined, RUN_MS)
  const sent = JSON.parse(submitted()?.body.toString('utf8') ?? '{}') as { prompt_id: string }
  finishRun(r.stand, sent.prompt_id, entry(sent.prompt_id))
}

export const startedId = (reply: ToolReply) => replyJson<{ jobId: string }>(reply).jobId
