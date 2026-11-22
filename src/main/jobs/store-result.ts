// P4-5 (spec/ai-jobs.md "Shared job helpers", "A plain sentence per failure cause"): one
// result file written with writeManaged, then added with asset.addGenerated. Their failures
// become local failures. A write error's own code goes to one warn line, with no path.
import { ulid } from 'ulid'
import type { JobRunContext } from '@/main/jobs/types'
import type { ProjectHandle } from '@/main/db/project-file'
import { LocalFailure, errnoCode, writeFailureReason } from './local-failure'

// P7-16: `video` is a generated clip's facts as checkMp4 read them, kept on its asset row.
export type StoredFile = {
  jobId: string
  bytes: Uint8Array
  ext: string
  model: string
  video?: { width: number; height: number; durationMs: number }
}

async function write(jc: JobRunContext, project: ProjectHandle, file: StoredFile, assetId: string) {
  try {
    await jc.deps.assets.writeManaged(project, { assetId, ext: file.ext, bytes: file.bytes })
  } catch (e) {
    const reason = writeFailureReason(e)
    if (reason === 'assets_not_writable') {
      jc.deps.log.write({
        level: 'warn',
        event: 'job',
        name: 'result.write',
        actor: 'system',
        projectId: jc.projectId,
        jobId: file.jobId,
        ok: false,
        errorKind: 'other',
        message: 'A result file could not be written.',
        context: { code: errnoCode(e) },
      })
    }
    throw new LocalFailure(reason)
  }
}

// Returns the new asset's ID.
export async function storeResult(
  jc: JobRunContext,
  project: ProjectHandle,
  file: StoredFile,
): Promise<string> {
  const assetId = ulid()
  await write(jc, project, file, assetId)
  // [1.58] J-4, J-13, J-14: the asset row keeps the model the result names.
  const added = await jc.system('asset.addGenerated', {
    projectId: jc.projectId,
    jobId: file.jobId,
    files: [{ assetId, ext: file.ext }],
    ...(file.model && { model: file.model }),
    ...(file.video && { video: file.video }),
  })
  if (!added.ok) throw new LocalFailure('results_not_added')
  return assetId
}
