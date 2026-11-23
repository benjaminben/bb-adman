// The image_generation job kind (SPEC 14 slice H; SPEC 6.2, 6.6, 6.11.1; FR-063 to FR-068).
// One generate call per picture with count 1, two at a time, so each call is counted and one
// failure does not lose the others. Every picture goes through toPng (L6), gets the details
// embedded, is stored through storeResult, then kept. P4-5: the references are read through
// readPictures, so a local cause ends the job with its own reason (OI-68).
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { runOptions } from '@/main/jobs/progress'
import { embedGenerationDetails } from '@/main/jobs/png-details'
import { readPictures } from '@/main/jobs/read-pictures'
import { storeResult } from '@/main/jobs/store-result'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { PICTURE_NOT_DECODED } from '@/main/png-converter'
import {
  ProviderCancelled,
  ProviderFailure,
  type ImageFile,
  type ImageProvider,
  type ImageResult,
} from '@/main/providers/types'
import { promptToSend } from '@/shared/generation/prompt'
import type { JobRow } from '@/shared/schemas/rows/job'
import { imageJobRequest, type ImageJobResult } from '@/shared/schemas/jobs/image-generation'

// SPEC 6.2: "count images means count calls, run two at a time".
export const PICTURES_AT_ONCE = 2

export type ImageAdapterFor = (deps: CoreDeps, providerId: string) => ImageProvider

type Outcome = 'stored' | 'failed' | 'stopped'

type Run = {
  jc: JobRunContext
  job: JobRow
  project: ProjectHandle
  provider: ImageProvider
  input: {
    prompt: string
    references: ImageFile[]
    width: number
    height: number
    workflowId?: string
  }
  assetIds: string[]
  failures: Record<string, number>
  firstFailure: ProviderFailure | null
}

function fail(run: Run, failure: ProviderFailure): Outcome {
  const { kind } = failure.error
  run.failures[kind] = (run.failures[kind] ?? 0) + 1
  run.firstFailure ??= failure
  return 'failed'
}

// A copy of what has arrived, for jc.keep and for job.result (H-R1).
const soFar = (run: Run): ImageJobResult => ({
  assetIds: [...run.assetIds],
  failures: { ...run.failures },
})

const otherFailure = (detail: string) => new ProviderFailure({ kind: 'other', detail })

async function ask(run: Run): Promise<ImageResult> {
  const { jc, provider, input } = run
  const [first] = await jc.call(() => provider.generate({ ...input, count: 1 }, runOptions(jc)))
  if (!first) throw otherFailure('No picture in the answer')
  return first
}

// SPEC 6.6: the details, then the PNG the app's own encoder wrote.
function pngOf(run: Run, result: ImageResult): Uint8Array {
  const { jc, job } = run
  const png = jc.deps.toPng(result.bytes)
  return embedGenerationDetails(png, {
    app: 'Adman',
    appVersion: jc.deps.appVersion,
    provider: job.provider ?? '',
    model: result.model,
    prompt: run.input.prompt,
    kind: 'image_generation',
    createdAt: jc.deps.now().toISOString(),
    // [1.53] G-1: no key is added when the provider gave no details.
    ...(result.details && {
      models: [...result.details.models],
      workflow: { ...result.details.workflow },
    }),
  })
}

async function store(run: Run, png: Uint8Array, model: string): Promise<Outcome> {
  const { jc, job, project } = run
  const file = { jobId: job.id, bytes: png, ext: 'png', model }
  run.assetIds.push(await storeResult(jc, project, file))
  jc.keep(soFar(run))
  return 'stored'
}

// FN-3, SPEC 6.11.2: a call not yet sent is skipped after a stop. Once an answer is in hand it
// was paid for, so it is converted and stored whatever the stop state.
async function onePicture(run: Run): Promise<Outcome> {
  if (run.jc.cancelled()) return 'stopped'
  let result: ImageResult
  try {
    result = await ask(run)
  } catch (e) {
    if (e instanceof ProviderFailure) return fail(run, e)
    if (e instanceof ProviderCancelled) return 'stopped'
    throw e
  }
  let png: Uint8Array
  try {
    png = pngOf(run, result)
  } catch {
    // SPEC 6.2 [1.20] F-05: the paid call stays counted; this picture failed as `other`.
    return fail(run, otherFailure(PICTURE_NOT_DECODED))
  }
  return store(run, png, result.model)
}

// Runs count pictures, at most PICTURES_AT_ONCE at a time. After an unforeseen error no new
// call is sent; every started picture is waited for before that error is thrown.
async function allPictures(run: Run, count: number): Promise<Outcome[]> {
  const outcomes: Outcome[] = []
  const errors: unknown[] = []
  let next = 0
  const worker = async () => {
    while (next < count && errors.length === 0) {
      next += 1
      try {
        outcomes.push(await onePicture(run))
      } catch (e) {
        errors.push(e)
        outcomes.push('stopped')
      }
      run.jc.progress(outcomes.length / count)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PICTURES_AT_ONCE, count) }, worker))
  if (errors.length > 0) throw errors[0]
  return outcomes
}

async function runImageJob(
  jc: JobRunContext,
  job: JobRow,
  imageFor: ImageAdapterFor,
): Promise<ImageJobResult> {
  const request = imageJobRequest.parse(job.request)
  const providerId = job.provider ?? ''
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  requireProviderKeys(jc.deps, providerId, 'generate pictures')
  const references = await readPictures(jc, project, request.referenceAssetIds)
  const run: Run = {
    jc,
    job,
    project,
    provider: imageFor(jc.deps, providerId),
    input: {
      prompt: promptToSend(request.prompt, { pictures: request.referenceAssetIds.length }),
      references,
      width: request.width,
      height: request.height,
      // D-104: the workflow the command chose, given only when the row names one.
      ...(request.workflowId !== undefined && { workflowId: request.workflowId }),
    },
    assetIds: [],
    failures: {},
    firstFailure: null,
  }
  const outcomes = await allPictures(run, request.count)
  // SPEC 6.11.1 handler rule, FN-3 ruling for the mixed case: when some pictures were never
  // sent (or the provider confirmed the stop), the job ends cancelled and keeps the pictures
  // that arrived. When every asked picture arrived after a stop, the handler returns and the
  // job ends succeeded with finishedAfterCancel (job-end.ts).
  if (outcomes.includes('stopped')) {
    jc.keep(soFar(run))
    throw new ProviderCancelled()
  }
  if (run.assetIds.length === 0 && run.firstFailure) throw run.firstFailure
  return soFar(run)
}

const defaultImageFor: ImageAdapterFor = (deps, providerId) => adapterFor(deps, providerId, 'image')

export function imageGenerationKind(imageFor: ImageAdapterFor = defaultImageFor): JobKindHandler {
  return { kind: 'image_generation', run: (jc, job) => runImageJob(jc, job, imageFor) }
}
