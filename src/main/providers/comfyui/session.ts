// SPEC 6.10.6 steps 1 and 3, 14 1.43 N-03 (security class): what every ComfyUI run does
// before it sends work, shared by the picture and video adapters. The saved address; a client
// pinned to it, so a change stops the run with nothing more sent (address_changed); then the
// check, and nothing else is sent unless it answered ok with nothing missing.
import { randomUUID } from 'node:crypto'
import type { AdapterContext } from '@/main/providers/types'
import { createComfyClient, type ComfyClient } from './client'
import { checkFailure, comfyFailure, missingFailure } from './failures'
import type { ServerChecks } from './needs'
import { comfyOwnPorts } from './own-ports'
import type { RunTiming } from './run'
import { NON_DRAFT_WORKFLOWS } from './workflows'
import type { WorkflowSpec } from './workflows/types'

export const realTiming: RunTiming = {
  now: Date.now,
  newId: randomUUID,
  sleep: (ms, signal) =>
    new Promise((done) => {
      const stop = () => {
        clearTimeout(timer)
        done()
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', stop)
        done()
      }, ms)
      signal?.addEventListener('abort', stop, { once: true })
    }),
}

// Every call first checks that the saved address is still the run's origin.
function pinnedTo(client: ComfyClient, still: () => boolean): ComfyClient {
  type Call = (...args: unknown[]) => unknown
  const guarded = {} as Record<string, unknown>
  for (const [name, fn] of Object.entries(client) as Array<[string, Call]>) {
    guarded[name] = (...args: unknown[]) => {
      if (!still()) throw comfyFailure('address_changed', 'The address changed during the run')
      return fn(...args)
    }
  }
  return guarded as ComfyClient
}

const savedOrigin = (ctx: AdapterContext) => ctx.settings().comfyui.baseUrl

// The saved address, or address_needed.
export function runOrigin(ctx: AdapterContext): string {
  const origin = savedOrigin(ctx)
  if (origin === null) throw comfyFailure('address_needed', 'No address saved')
  return origin
}

// A client for the run's origin that sends nothing once the saved address changed.
export function pinnedClient(ctx: AdapterContext, origin: string): ComfyClient {
  const ownPorts = () => comfyOwnPorts(ctx.settings().mcp.port)
  const still = () => savedOrigin(ctx) === origin
  return pinnedTo(createComfyClient({ origin, ownPorts }), still)
}

// The check of 6.10.3 for the run's workflow. Gives the server's version.
export async function checked(
  checks: ServerChecks,
  origin: string,
  client: ComfyClient,
  spec: WorkflowSpec,
): Promise<string | undefined> {
  const result = await checks.run(origin, client, NON_DRAFT_WORKFLOWS)
  if (result.outcome !== 'ok') throw checkFailure(result.outcome)
  const missing = result.workflows.find((w) => w.id === spec.id)?.missing
  if (!missing) throw new Error(`The check did not compare ${spec.id}`)
  if (missing.length > 0) throw missingFailure(missing)
  return result.version
}
