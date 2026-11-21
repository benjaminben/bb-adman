// The image_generation job kind (SPEC 14 slice H; SPEC 6.2, 6.6, 6.11.1; FR-063 to FR-068).
// One generate call per picture with count 1, two at a time, so each call is counted and one
// failure does not lose the others. Every picture goes through toPng (L6), gets the details
// embedded, is written with writeManaged and added with asset.addGenerated, then kept.
import { ulid } from 'ulid'
import { z } from 'zod'
import type { JobKindHandler, JobRunContext } from '../types'
import { runOptions } from '../progress'
import { embedGenerationDetails } from '../png-details'
import type { CoreDeps } from '../../core-deps'
import type { ProjectHandle } from '../../db/project-file'
import { adapterFor } from '../../providers/adapters'
import { requireProviderKeys } from '../../providers/require-keys'
import { PICTURE_NOT_DECODED } from '../../png-converter'
import {
  ProviderCancelled,
  ProviderFailure,
  type ImageFile,
  type ImageProvider,
  type ImageResult,
} from '../../providers/types'
import { promptToSend } from '../../../shared/generation/prompt'
import { MAX_IMAGES_PER_RUN } from '../../../shared/config/defaults'
import type { JobRow } from '../../../shared/schemas/rows/job'

// SPEC 6.2: "count images means count calls, run two at a time".
export const PICTURES_AT_ONCE = 2

// What generation.runImages stores in job.request.
export const imageJobRequest = z.object({
  prompt: z.string().min(1),
  referenceAssetIds: z.array(z.string().min(1)),
  count: z.number().int().min(1).max(MAX_IMAGES_PER_RUN),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

export type ImageAdapterFor = (deps: CoreDeps, providerId: string) => ImageProvider

type Outcome = 'stored' | 'failed' | 'stopped'

type Run = {
  jc: JobRunContext
  job: JobRow
  project: ProjectHandle
  provider: ImageProvider
  input: { prompt: string; references: ImageFile[]; width: number; height: number }
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
  })
}

async function store(run: Run, png: Uint8Array): Promise<Outcome> {
  const { jc, job, project } = run
  const assetId = ulid()
  if (jc.cancelled()) return 'stopped'
  await jc.deps.assets.writeManaged(project, { assetId, ext: 'png', bytes: png })
  if (jc.cancelled()) return 'stopped'
  const files = [{ assetId, ext: 'png' }]
  const added = await jc.system('asset.addGenerated', {
    projectId: jc.projectId,
    jobId: job.id,
    files,
  })
  if (!added.ok) throw new Error(`asset.addGenerated refused: ${added.error.code}`)
  run.assetIds.push(assetId)
  jc.keep({ assetIds: [...run.assetIds], failures: { ...run.failures } })
  return 'stored'
}

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
  if (run.jc.cancelled()) return 'stopped'
  let png: Uint8Array
  try {
    png = pngOf(run, result)
  } catch {
    // SPEC 6.2 [1.20] F-05: the paid call stays counted; this picture failed as `other`.
    return fail(run, otherFailure(PICTURE_NOT_DECODED))
  }
  return store(run, png)
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

async function readReferences(deps: CoreDeps, project: ProjectHandle, ids: string[]) {
  const references: ImageFile[] = []
  for (const id of ids) references.push(await deps.assets.read(project, id))
  return references
}

async function runImageJob(jc: JobRunContext, job: JobRow, imageFor: ImageAdapterFor) {
  const request = imageJobRequest.parse(job.request)
  const providerId = job.provider ?? ''
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  requireProviderKeys(jc.deps, providerId, 'generate pictures')
  const references = await readReferences(jc.deps, project, request.referenceAssetIds)
  const run: Run = {
    jc,
    job,
    project,
    provider: imageFor(jc.deps, providerId),
    input: {
      prompt: promptToSend(request.prompt),
      references,
      width: request.width,
      height: request.height,
    },
    assetIds: [],
    failures: {},
    firstFailure: null,
  }
  const outcomes = await allPictures(run, request.count)
  // SPEC 6.11.1 handler rule: after a stop, keep what arrived and end with ProviderCancelled.
  if (outcomes.includes('stopped')) {
    jc.keep({ assetIds: [...run.assetIds], failures: { ...run.failures } })
    throw new ProviderCancelled()
  }
  if (run.assetIds.length === 0 && run.firstFailure) throw run.firstFailure
  return { assetIds: run.assetIds, failures: run.failures }
}

const defaultImageFor: ImageAdapterFor = (deps, providerId) => adapterFor(deps, providerId, 'image')

export function imageGenerationKind(imageFor: ImageAdapterFor = defaultImageFor): JobKindHandler {
  return { kind: 'image_generation', run: (jc, job) => runImageJob(jc, job, imageFor) }
}
