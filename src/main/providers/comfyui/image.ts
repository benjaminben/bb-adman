// SPEC 6.10.6 [REQ: FR-256, FR-259, FR-260, FR-264] (security class): ImageProvider for
// ComfyUI. Each run: the saved address, the workflow for the job, the check (6.10.3), the
// upload of each reference, then one submission per picture. [1.46] An upload sends only the
// picture's bytes under the app's own name; nothing else about the picture enters a request.
// The run keeps the origin it started with: before each request it compares it with the
// saved address, and a change stops the run with nothing more sent (address_changed).
import { randomUUID } from 'node:crypto'
import {
  ProviderCancelled,
  type AdapterContext,
  type ImageFile,
  type ImageProvider,
  type ImageResult,
} from '../types'
import { createComfyClient, type ComfyClient } from './client'
import { checkFailure, comfyFailure, missingFailure } from './failures'
import { serverChecks, type ServerChecks } from './needs'
import { comfyOwnPorts } from './own-ports'
import { runPicture, type RunEnv, type RunTiming } from './run'
import { uploadName } from './values'
import { NON_DRAFT_WORKFLOWS } from './workflows'
import type { WorkflowSpec } from './workflows/types'

const realTiming: RunTiming = {
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

export type ComfyImageDeps = { timing?: RunTiming; checks?: ServerChecks }

// The command has already refused a job with no workflow it may use (SPEC 14 1.41): a proven
// one, else the trial one the user with the hand-test tools was allowed. Never a draft.
export function workflowForRun(job: 'image' | 'image_refs'): WorkflowSpec {
  const fitting = NON_DRAFT_WORKFLOWS.filter((w) => w.job === job)
  const chosen = fitting.find((w) => w.status === 'proven') ?? fitting[0]
  if (!chosen) throw new Error(`No shipped workflow for ${job}`)
  return chosen
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

async function checked(
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

// The file name to put in the graph: the server's answer, after the client's checks.
async function uploaded(client: ComfyClient, file: ImageFile): Promise<string> {
  const kept = await client.uploadImage(uploadName(file.bytes), file.bytes)
  return kept.subfolder === '' ? kept.name : `${kept.subfolder}/${kept.name}`
}

export function comfyImage(ctx: AdapterContext, deps: ComfyImageDeps = {}): ImageProvider {
  const timing = deps.timing ?? realTiming
  const checks = deps.checks ?? serverChecks
  const savedOrigin = () => ctx.settings().comfyui.baseUrl
  return {
    async generate(input, opts = {}) {
      if (opts.signal?.aborted) throw new ProviderCancelled()
      const origin = savedOrigin()
      if (origin === null) throw comfyFailure('address_needed', 'No address saved')
      const spec = workflowForRun(input.references.length > 0 ? 'image_refs' : 'image')
      const ownPorts = () => comfyOwnPorts(ctx.settings().mcp.port)
      const still = () => savedOrigin() === origin
      const client = pinnedTo(createComfyClient({ origin, ownPorts }), still)
      const serverVersion = await checked(checks, origin, client, spec)
      const references: string[] = []
      for (const file of input.references) {
        if (opts.signal?.aborted) throw new ProviderCancelled()
        references.push(await uploaded(client, file))
      }
      const env: RunEnv = { client, timing, serverVersion }
      const ask = { prompt: input.prompt, width: input.width, height: input.height, references }
      const results: ImageResult[] = []
      for (let i = 0; i < input.count; i++) results.push(await runPicture(env, spec, ask, opts))
      return results
    },
    // SPEC 6.10.8: extend is left out of CU-4, as 1.41 allows; it is built with CU-6b.
    async extend() {
      throw new Error('Extending a picture with ComfyUI is not built yet')
    },
  }
}
