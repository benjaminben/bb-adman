// P4-9 (spec/ai-jobs.md "Cut-out") [REQ: FR-307] (security class): CutoutProvider for ComfyUI.
// It does what `generate` does for one picture: the saved address, the shipped cut-out
// workflow, the check, one upload of the picture's bytes under uploadName, one submission,
// polling, the result from the workflow's own output node, its type checked. The only value
// from the caller that reaches the graph is the name the server kept the upload under.
import {
  ProviderCancelled,
  type AdapterContext,
  type CutoutProvider,
  type ImageFile,
  type ImageResult,
  type RunOptions,
} from '@/main/providers/types'
import { uploaded, workflowForRun, type ComfyImageDeps } from './image'
import { serverChecks } from './needs'
import { runPicture, type RunEnv } from './run'
import { checked, checkList, pinnedClient, realTiming, runLive, runOrigin } from './session'
import type { WorkflowSpec } from './workflows/types'

// After the check answered ok: the upload, then the run. The graph has no size slot, so the
// run reads no width or height.
export async function cutOutChecked(
  env: RunEnv,
  spec: WorkflowSpec,
  image: ImageFile,
  opts: RunOptions = {},
): Promise<ImageResult> {
  if (opts.signal?.aborted) throw new ProviderCancelled()
  const name = await uploaded(env.client, image)
  return runPicture(env, spec, { width: 0, height: 0, references: [name] }, opts)
}

export function comfyCutout(ctx: AdapterContext, deps: ComfyImageDeps = {}): CutoutProvider {
  const timing = deps.timing ?? realTiming
  const checks = deps.checks ?? serverChecks
  return {
    async cutOut(input, opts = {}) {
      if (opts.signal?.aborted) throw new ProviderCancelled()
      const origin = runOrigin(ctx)
      const spec = workflowForRun('cutout')
      const live = runLive(ctx, origin)
      const client = pinnedClient(ctx, origin, live)
      const serverVersion = await checked(checks, origin, client, spec, checkList(ctx))
      return cutOutChecked({ client, timing, serverVersion, live }, spec, input.image, opts)
    },
  }
}
