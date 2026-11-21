// P4-5 (spec/ai-jobs.md "Shared job helpers"): the pictures a job sends, read again through
// AssetService.read. Its refusals become local failures; any other error goes on as it is.
import type { JobRunContext } from '@/main/jobs/types'
import type { ProjectHandle } from '@/main/db/project-file'
import type { ImageFile } from '@/main/providers/types'
import { LocalFailure, readRefusalReason } from './local-failure'

export async function readPictures(
  jc: JobRunContext,
  project: ProjectHandle,
  ids: readonly string[],
): Promise<ImageFile[]> {
  const files: ImageFile[] = []
  for (const id of ids) {
    try {
      files.push(await jc.deps.assets.read(project, id))
    } catch (e) {
      const reason = readRefusalReason(e)
      if (reason) throw new LocalFailure(reason)
      throw e
    }
  }
  return files
}
