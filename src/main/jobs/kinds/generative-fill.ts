// The generative_fill job kind (spec/links-and-sync.md "Generative fill"; attached [D-036]).
// The key guard again; the source read again through readPictures, so only AssetService.read's
// clean PNG is sent; one extend call; toPng; the details embedded with kind 'generative_fill';
// stored through storeResult. It writes nothing to any layer: generation.applyFill places it.
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { runOptions } from '@/main/jobs/progress'
import { embedGenerationDetails } from '@/main/jobs/png-details'
import { readPictures } from '@/main/jobs/read-pictures'
import { storeResult } from '@/main/jobs/store-result'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { PICTURE_NOT_DECODED } from '@/main/png-converter'
import { ProviderCancelled, ProviderFailure, type ImageResult } from '@/main/providers/types'
import {
  generativeFillJobRequest,
  type GenerativeFillJobResult,
} from '@/shared/schemas/jobs/generative-fill'
import type { JobRow } from '@/shared/schemas/rows/job'

function pngOf(jc: JobRunContext, job: JobRow, result: ImageResult, prompt: string): Uint8Array {
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
    prompt,
    kind: 'generative_fill',
    createdAt: jc.deps.now().toISOString(),
    ...(result.details && {
      models: [...result.details.models],
      workflow: { ...result.details.workflow },
    }),
  })
}

async function runGenerativeFillJob(
  jc: JobRunContext,
  job: JobRow,
): Promise<GenerativeFillJobResult> {
  const request = generativeFillJobRequest.parse(job.request)
  const providerId = job.provider ?? ''
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  requireProviderKeys(jc.deps, providerId, 'generate a fill')
  const [image] = await readPictures(jc, project, [request.sourceAssetId])
  if (!image) throw new ProviderFailure({ kind: 'other', detail: 'No source picture' })
  const provider = adapterFor(jc.deps, providerId, 'image')
  const { prompt, placement, width, height } = request
  const result = await jc.call(() =>
    provider.extend({ image, placement, width, height, prompt }, runOptions(jc)),
  )
  const png = pngOf(jc, job, result, prompt)
  const file = { jobId: job.id, bytes: png, ext: 'png', model: result.model }
  const assetId = await storeResult(jc, project, file)
  return { assetIds: [assetId] }
}

export function generativeFillKind(): JobKindHandler {
  return { kind: 'generative_fill', run: runGenerativeFillJob }
}
