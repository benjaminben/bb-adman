// P7-16 (phase-07.md "The format switch and the start", A-176): the first frame of a
// `background` start, drawn at job time from the variant's background layer and clip track by
// RenderService.renderBackground, then fitted to the run size. Any failure, a variant that is
// gone among them, is the local failure background_not_drawn; nothing of the error is kept.
import type { JobRunContext } from '@/main/jobs/types'
import type { ProjectHandle } from '@/main/db/project-file'
import { LocalFailure } from './local-failure'

type Size = { width: number; height: number }

export async function backgroundFrame(
  jc: JobRunContext,
  project: ProjectHandle,
  variantId: string | null,
  size: Size,
): Promise<Uint8Array> {
  try {
    if (!variantId) throw new Error('The job names no variant')
    const png = await jc.deps.render.renderBackground(project, variantId, size)
    return jc.deps.fitPicture(png, size)
  } catch {
    throw new LocalFailure('background_not_drawn')
  }
}
