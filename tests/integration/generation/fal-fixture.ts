// Test helper for P7-15: the real core with the real fal.ai Seedance adapter, its fetch a
// recorded-answer stand-in (tests/unit/main/providers/fal-seedance/stand-in.ts). The adapter is
// built through the provider folder, as the video job kind's default videoFor does, so the real
// registry row is used. The global fetch is stubbed to refuse, so nothing leaves the machine.
import { vi } from 'vitest'
import { adapters as falAdapters } from '@/main/providers/fal-seedance'
import { falVideo } from '@/main/providers/fal-seedance/video'
import {
  MEDIA_URL,
  REQUEST_ID,
  clip,
  json,
  standIn,
  type Seen,
} from '../../unit/main/providers/fal-seedance/stand-in'
import { makeGenerationFixture, VARIANT, type GenerationFixture } from './generation-fixture'

export { REQUEST_ID, MEDIA_URL }
// Made up; it does not look like a real key.
export const FAL_KEY = 'made-up-fal-value-for-p7-15'

export type FalWorld = {
  f: GenerationFixture
  seen: Seen[]
  // What the status call answers now; a test changes it as the run goes on.
  status: { now: unknown }
  // What a cancel answers, and an optional answer for every call (a failure the test plants).
  cancelStatus: { now: number }
  override: { now: ((seen: Seen) => Response) | null }
  globalFetch: ReturnType<typeof vi.spyOn>
}

export const IN_QUEUE = { status: 'IN_QUEUE', queue_position: 2 }
export const IN_PROGRESS = { status: 'IN_PROGRESS' }
export const COMPLETED = { status: 'COMPLETED' }

export const ask = {
  variantId: VARIANT,
  prompt: 'Waves on a rock at dusk',
  durationMs: 4_000,
  provider: 'fal-seedance',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [] as string[],
}

export async function falWorld(opts: { key?: boolean } = {}): Promise<FalWorld> {
  const f = await makeGenerationFixture()
  const status = { now: IN_PROGRESS as unknown }
  const cancelStatus = { now: 200 }
  const override: FalWorld['override'] = { now: null }
  const { fetchFn, seen } = standIn((s) => {
    if (override.now) return override.now(s)
    const path = new URL(s.url).pathname
    if (s.method === 'POST') return json({ request_id: REQUEST_ID })
    if (s.method === 'PUT') return json({}, cancelStatus.now)
    if (path.endsWith('/status')) return json(status.now)
    if (path.endsWith(`/requests/${REQUEST_ID}`)) return json({ video: { url: MEDIA_URL } })
    if (s.url === MEDIA_URL) return new Response(clip(), { status: 200 })
    return json({ detail: 'not recorded' }, 500)
  })
  vi.spyOn(falAdapters, 'video').mockImplementation((ctx) => falVideo(ctx, { fetch: fetchFn }))
  const globalFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network'))
  if (opts.key !== false) f.core.deps.secrets.set('fal.apiKey', FAL_KEY)
  return { f, seen, status, cancelStatus, override, globalFetch }
}

export const startFal = (
  w: FalWorld,
  input: Record<string, unknown> = {},
  actor: 'user' | 'agent' = 'user',
) =>
  w.f.core.bus.execute(
    'generation.startVideo',
    { projectId: w.f.projectId, ...ask, ...input },
    { actor },
  )

export const calls = (w: FalWorld, method: string) => w.seen.filter((s) => s.method === method)
export const statusCalls = (w: FalWorld) => w.seen.filter((s) => s.url.endsWith('/status'))

export const stageIs = (w: FalWorld, id: string, stage: string) => () =>
  (w.f.job(id)?.result as { stage?: string } | null)?.stage === stage
