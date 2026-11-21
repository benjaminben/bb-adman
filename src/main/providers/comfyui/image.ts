// SPEC 6.10.6 [REQ: FR-256, FR-259, FR-260, FR-264] (security class): ImageProvider for
// ComfyUI. Each run: the saved address, the workflow for the job, the check (6.10.3), the
// upload of each reference, then one submission per picture. [1.46] An upload sends only the
// picture's bytes under the app's own name; nothing else about the picture enters a request.
// The run keeps the origin it started with: before each request it compares it with the
// saved address, and a change stops the run with nothing more sent (address_changed).
import {
  ProviderCancelled,
  type AdapterContext,
  type ImageFile,
  type ImageProvider,
  type ImageResult,
} from '../types'
import type { ComfyClient } from './client'
import { serverChecks, type ServerChecks } from './needs'
import { runPicture, type RunEnv, type RunTiming } from './run'
import { checked, pinnedClient, realTiming, runOrigin } from './session'
import { uploadName } from './values'
import { NON_DRAFT_WORKFLOWS } from './workflows'
import type { WorkflowChoice } from './workflows/offered'
import type { WorkflowSpec } from './workflows/types'

export type ComfyImageDeps = { timing?: RunTiming; checks?: ServerChecks }

// The command has already refused a job with no workflow it may use (SPEC 14 1.41): a proven
// one, else the trial one the user with the hand-test tools was allowed. Never a draft.
export function workflowForRun(job: WorkflowChoice['job'], start?: WorkflowChoice['videoStart']) {
  const fitting = NON_DRAFT_WORKFLOWS.filter(
    (w) =>
      w.job === job &&
      (start === undefined ||
        (w.videoStart?.firstFrame === start.firstFrame &&
          w.videoStart.references === start.references)),
  )
  const chosen: WorkflowSpec | undefined =
    fitting.find((w) => w.status === 'proven') ?? fitting[0]
  if (!chosen) throw new Error(`No shipped workflow for ${job}`)
  return chosen
}

// The file name to put in the graph: the server's answer, after the client's checks.
async function uploaded(client: ComfyClient, file: ImageFile): Promise<string> {
  const kept = await client.uploadImage(uploadName(file.bytes), file.bytes)
  return kept.subfolder === '' ? kept.name : `${kept.subfolder}/${kept.name}`
}

export function comfyImage(ctx: AdapterContext, deps: ComfyImageDeps = {}): ImageProvider {
  const timing = deps.timing ?? realTiming
  const checks = deps.checks ?? serverChecks
  return {
    async generate(input, opts = {}) {
      if (opts.signal?.aborted) throw new ProviderCancelled()
      const origin = runOrigin(ctx)
      const spec = workflowForRun(input.references.length > 0 ? 'image_refs' : 'image')
      const client = pinnedClient(ctx, origin)
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
