// The cutout job kind (spec/ai-jobs.md "Cut-out"; FR-307). The key guard; the source read
// again through readPictures, so only AssetService.read's clean PNG is sent; one cutOut call;
// toPng, which keeps the alpha; the details embedded with kind 'cutout' and an empty prompt;
// stored through storeResult. The source asset is never changed.
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { runOptions } from '@/main/jobs/progress'
import { embedGenerationDetails } from '@/main/jobs/png-details'
import { readPictures } from '@/main/jobs/read-pictures'
import { storeResult } from '@/main/jobs/store-result'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { PICTURE_NOT_DECODED } from '@/main/png-converter'
import { ProviderCancelled, ProviderFailure, type ImageResult } from '@/main/providers/types'
import { cutoutJobRequest, type CutoutJobResult } from '@/shared/schemas/jobs/cutout'
import type { JobRow } from '@/shared/schemas/rows/job'

function pngOf(jc: JobRunContext, job: JobRow, result: ImageResult): Uint8Array {
  let png: Uint8Array
  try {
    png = jc.deps.toPng(result.bytes)
  } catch {
    throw new ProviderFailure({ kind: 'other', detail: PICTURE_NOT_DECODED })
  }
  return embedGenerationDetails(png, {
    app: 'Adman',
    appVersion: jc.deps.appVersion,
    provider: job.provider ?? '',
    model: result.model,
    prompt: '',
    kind: 'cutout',
    createdAt: jc.deps.now().toISOString(),
    ...(result.details && {
      models: [...result.details.models],
      workflow: { ...result.details.workflow },
    }),
  })
}

async function runCutoutJob(jc: JobRunContext, job: JobRow): Promise<CutoutJobResult> {
  const request = cutoutJobRequest.parse(job.request)
  const providerId = job.provider ?? ''
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  requireProviderKeys(jc.deps, providerId, 'cut out a picture')
  const [image] = await readPictures(jc, project, [request.sourceAssetId])
  if (!image) throw new ProviderFailure({ kind: 'other', detail: 'No source picture' })
  const provider = adapterFor(jc.deps, providerId, 'cutout')
  const result = await jc.call(() => provider.cutOut({ image }, runOptions(jc)))
  const png = pngOf(jc, job, result)
  const file = { jobId: job.id, bytes: png, ext: 'png', model: result.model }
  const assetId = await storeResult(jc, project, file)
  return { assetIds: [assetId] }
}

export function cutoutKind(): JobKindHandler {
  return { kind: 'cutout', run: runCutoutJob }
}
