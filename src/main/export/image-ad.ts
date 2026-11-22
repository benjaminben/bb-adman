// One image ad of an export (spec/phases/phase-08.md "Export run", "Drawing at full size"):
// draw it at its full pixel size, encode it as the plan says, write it through the export
// target. The file is a fresh draw, so it holds no generation details and no path [FR-068].
import type { JobRunContext } from '@/main/jobs/types'
import { ProviderCancelled } from '@/main/providers/types'
import { AD_FAILURES } from '@/shared/export/messages'
import type { SceneInput } from '@/shared/scene/types'
import { ExportFailure } from './failure'
import type { ExportPlan, ExportTarget } from './types'

// Gives the PNG as drawn, for the report's picture. Throws an ExportFailure with the ad's
// sentence, or ProviderCancelled when a stop was asked before the file was written.
export async function exportImageAd(
  jc: JobRunContext,
  input: SceneInput,
  plan: ExportPlan,
  target: ExportTarget,
  path: string,
): Promise<Uint8Array> {
  let png: Uint8Array
  try {
    png = await jc.deps.render.drawFull(input)
  } catch {
    throw new ExportFailure(AD_FAILURES.notDrawn)
  }
  if (jc.cancelled()) throw new ProviderCancelled()
  try {
    const bytes =
      plan.imageFormat === 'jpg' ? jc.deps.exportPictures.toJpeg(png, plan.jpgQuality) : png
    await target.write(path, bytes)
  } catch {
    throw new ExportFailure(AD_FAILURES.notWritten)
  }
  return png
}
