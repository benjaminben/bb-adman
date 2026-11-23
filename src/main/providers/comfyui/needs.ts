// SPEC 6.10.3 [REQ: FR-252, FR-263, FR-266] (security class): the check, and "what is
// missing". [1.43] This check is the one holder of "exactly one request before the server has
// shown it is ComfyUI" (6.10.1, N-03): it sends GET /system_stats first and nothing more
// unless that answer has the ComfyUI shape. It sends no prompt and no picture.
import type { MissingItem } from '@/shared/schemas/queries/app'
import {
  COMFY_CHECK_OUTCOMES,
  type ComfyCheck,
  type ComfyCheckOutcome,
} from '@/shared/schemas/commands/comfy-check'
import { ProviderFailure } from '@/main/providers/types'
import type { ComfyClient } from './client'
import type { WorkflowSpec } from './workflows/types'

export type CheckClient = Pick<ComfyClient, 'systemStats' | 'modelFiles' | 'nodeInfo'>

export const VERSION_UNREAD_NOTE =
  "Adman could not read the server's version, so the version was not checked."
export const VERSION_NEWER_NOTE =
  'The server is newer than the version some workflows were checked with. They may still work.'

const CHECK_MS = 60_000

// A dotted version as numbers, or null when it cannot be read.
function versionOf(text: string): number[] | null {
  const match = /^v?(\d+(?:\.\d+)*)/.exec(text.trim())
  return match?.[1] ? match[1].split('.').map(Number) : null
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const gap = (a[i] ?? 0) - (b[i] ?? 0)
    if (gap !== 0) return gap
  }
  return 0
}

// A failure of the handshake or a later call, as an outcome; anything else is let through.
function outcomeOf(error: unknown): ComfyCheckOutcome {
  if (!(error instanceof ProviderFailure)) throw error
  const reason = error.error.reason
  const known = COMFY_CHECK_OUTCOMES.find((o) => o !== 'ok' && o === reason)
  // The server answered, but not as ComfyUI does.
  return known ?? 'not_comfyui'
}

async function compareNeeds(
  client: CheckClient,
  workflows: readonly WorkflowSpec[],
  server: number[] | null,
): Promise<ComfyCheck['workflows']> {
  // One call per folder and one per node class, however many workflows name them.
  const files = new Map<string, string[] | null>()
  for (const w of workflows) {
    for (const m of w.needs.models) {
      if (!files.has(m.folder)) files.set(m.folder, await client.modelFiles(m.folder))
    }
  }
  const nodes = new Map<string, boolean>()
  for (const w of workflows) {
    for (const c of w.needs.nodeClasses) {
      if (!nodes.has(c)) nodes.set(c, await client.nodeInfo(c))
    }
  }
  return workflows.map((w) => {
    const missing: MissingItem[] = []
    const needed = versionOf(w.needs.minComfyVersion)
    if (server && needed && compare(server, needed) < 0) {
      missing.push({ what: 'version', name: w.needs.minComfyVersion })
    }
    for (const m of w.needs.models) {
      const list = files.get(m.folder) ?? []
      const there = list.some((e) => e === m.file || e.endsWith(`/${m.file}`))
      if (!there) missing.push({ what: 'model', name: m.file, folder: m.folder })
    }
    for (const c of w.needs.nodeClasses) {
      if (!nodes.get(c)) missing.push({ what: 'node', name: c })
    }
    return { id: w.id, missing }
  })
}

function noteFor(server: number[] | null, workflows: readonly WorkflowSpec[]): string | undefined {
  if (!server) return VERSION_UNREAD_NOTE
  const newer = workflows.some((w) => {
    const checked = versionOf(w.needs.checkedWith)
    return checked !== null && compare(server, checked) > 0
  })
  return newer ? VERSION_NEWER_NOTE : undefined
}

export async function checkServer(
  client: CheckClient,
  workflows: readonly WorkflowSpec[],
): Promise<ComfyCheck> {
  let version: string
  try {
    version = (await client.systemStats()).comfyuiVersion
  } catch (error) {
    return { outcome: outcomeOf(error), workflows: [] }
  }
  const server = versionOf(version)
  try {
    const compared = await compareNeeds(client, workflows, server)
    const note = noteFor(server, workflows)
    return { outcome: 'ok', version, ...(note && { note }), workflows: compared }
  } catch (error) {
    return { outcome: outcomeOf(error), workflows: [] }
  }
}

// The result kept in memory for 60 seconds per origin, so the options of one run do not
// repeat the check (SPEC 6.10.3). `fresh` asks again whatever is kept. [1.45] B-5: only a
// kept `ok` is read; any other outcome is asked again.
export function createServerChecks(opts: { now?: () => number } = {}) {
  const now = opts.now ?? Date.now
  const kept = new Map<string, { at: number; result: ComfyCheck }>()
  return {
    async run(
      origin: string,
      client: CheckClient,
      workflows: readonly WorkflowSpec[],
      run: { fresh?: boolean } = {},
    ): Promise<ComfyCheck> {
      const hit = kept.get(origin)
      const usable = hit && hit.result.outcome === 'ok' && now() - hit.at < CHECK_MS
      if (!run.fresh && usable) return hit.result
      const result = await checkServer(client, workflows)
      kept.set(origin, { at: now(), result })
      return result
    },
    // D-104: a workflow added, changed or removed empties every kept result, so a run never
    // meets a kept check without its workflow.
    forget(): void {
      kept.clear()
    },
  }
}

// What a run or comfy.check uses; only the workflow commands forget (D-104).
export type ServerChecks = Pick<ReturnType<typeof createServerChecks>, 'run'>

// The app's one memory of checks, shared by comfy.check and the runs (CU-4, CU-6a).
export const serverChecks = createServerChecks()
