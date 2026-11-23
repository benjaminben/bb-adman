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
} from '@/main/providers/types'
import { fitSize, type Size, type SizeRule } from '@/shared/comfy/fit-size'
import type { Geometry } from '@/shared/schemas/layer'
import type { ComfyClient } from './client'
import { serverChecks, type ServerChecks } from './needs'
import { runPicture, type RunEnv, type RunTiming } from './run'
import { comfyFailure } from './failures'
import {
  checked,
  checkList,
  pinnedClient,
  realTiming,
  runLive,
  runOrigin,
  runWorkflows,
} from './session'
import { uploadName } from './values'
import { NON_DRAFT_WORKFLOWS, withoutDrafts } from './workflows'
import type { WorkflowChoice } from './workflows/offered'
import type { WorkflowSpec } from './workflows/types'

// `workflows` lets a test hand in a trial copy of a draft (P5-7); a draft in it is still
// never chosen.
export type ComfyImageDeps = {
  timing?: RunTiming
  checks?: ServerChecks
  workflows?: readonly WorkflowSpec[]
}

// The command has already refused a job with no workflow it may use (SPEC 14 1.41) and
// stored the one it chose in the job's request (D-104). With that ID the run gets exactly that
// workflow; one no longer on this computer is workflow_gone, before anything is sent. A row
// made before the ID was stored gets the proven one, else the first that fits. Never a draft.
export function workflowForRun(
  job: WorkflowChoice['job'],
  start?: WorkflowChoice['videoStart'],
  workflows: readonly WorkflowSpec[] = NON_DRAFT_WORKFLOWS,
  workflowId?: string,
) {
  const fitting = withoutDrafts(workflows).filter(
    (w) =>
      w.job === job &&
      (start === undefined ||
        (w.videoStart?.firstFrame === start.firstFrame &&
          w.videoStart.references === start.references)),
  )
  if (workflowId !== undefined) {
    const named = fitting.find((w) => w.id === workflowId)
    if (!named) throw comfyFailure('workflow_gone', 'The workflow is not on this computer')
    return named
  }
  const chosen: WorkflowSpec | undefined = fitting.find((w) => w.status === 'proven') ?? fitting[0]
  if (!chosen) throw new Error(`No shipped workflow for ${job}`)
  return chosen
}

// The file name to put in the graph: the server's answer, after the client's checks. Also
// used by the video adapter (SPEC 14 1.60 N-7).
export async function uploaded(client: ComfyClient, file: ImageFile): Promise<string> {
  const kept = await client.uploadImage(uploadName(file.bytes), file.bytes)
  return kept.subfolder === '' ? kept.name : `${kept.subfolder}/${kept.name}`
}

type Pad = { left: number; top: number; right: number; bottom: number }

const toEight = (n: number) => Math.round(n / 8) * 8

// SPEC comfyui-workflows "Extend a background": the run size from fitSize, the placement
// scaled by the same factor, each pad rounded to a multiple of 8, and the picture size what
// the pads leave. A picture that does not sit inside the canvas is a plain Error.
export function extendLayout(
  canvas: Size,
  placement: Pick<Geometry, 'x' | 'y' | 'width' | 'height'>,
  rule: SizeRule,
): { picture: Size; pad: Pad } {
  const run = fitSize(canvas, rule)
  const across = run.width / canvas.width
  const down = run.height / canvas.height
  const pad = {
    left: toEight(placement.x * across),
    top: toEight(placement.y * down),
    right: toEight((canvas.width - placement.x - placement.width) * across),
    bottom: toEight((canvas.height - placement.y - placement.height) * down),
  }
  const picture = {
    width: run.width - pad.left - pad.right,
    height: run.height - pad.top - pad.bottom,
  }
  if (Object.values(pad).some((n) => n < 0) || picture.width < 8 || picture.height < 8) {
    throw new Error('The picture does not sit inside the canvas')
  }
  return { picture, pad }
}

export function comfyImage(ctx: AdapterContext, deps: ComfyImageDeps = {}): ImageProvider {
  const timing = deps.timing ?? realTiming
  const checks = deps.checks ?? serverChecks
  return {
    async generate(input, opts = {}) {
      if (opts.signal?.aborted) throw new ProviderCancelled()
      const origin = runOrigin(ctx)
      const job = input.references.length > 0 ? 'image_refs' : 'image'
      const all = runWorkflows(ctx)
      const spec = workflowForRun(job, undefined, all, input.workflowId)
      const live = runLive(ctx, origin)
      const client = pinnedClient(ctx, origin, live)
      const serverVersion = await checked(checks, origin, client, spec, checkList(ctx))
      const references: string[] = []
      for (const file of input.references) {
        if (opts.signal?.aborted) throw new ProviderCancelled()
        references.push(await uploaded(client, file))
      }
      const env: RunEnv = { client, timing, serverVersion, live }
      const ask = { prompt: input.prompt, width: input.width, height: input.height, references }
      const results: ImageResult[] = []
      for (let i = 0; i < input.count; i++) results.push(await runPicture(env, spec, ask, opts))
      return results
    },
    // P5-7: the picture goes up as the one reference; the server does the canvas work.
    async extend(input, opts = {}) {
      if (opts.signal?.aborted) throw new ProviderCancelled()
      const spec = workflowForRun('extend', undefined, deps.workflows)
      const canvas = { width: input.width, height: input.height }
      const { picture, pad } = extendLayout(canvas, input.placement, spec.size)
      const origin = runOrigin(ctx)
      const live = runLive(ctx, origin)
      const client = pinnedClient(ctx, origin, live)
      const serverVersion = await checked(checks, origin, client, spec, checkList(ctx))
      if (opts.signal?.aborted) throw new ProviderCancelled()
      const reference = await uploaded(client, input.image)
      const ask = { prompt: input.prompt, ...picture, references: [reference], pad }
      return runPicture({ client, timing, serverVersion, live }, spec, ask, opts)
    },
  }
}
