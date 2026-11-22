// "Going there" (spec/phases/round-2-editor.md D6, R2E-6): where a finished job's result is,
// used by the result notice, the activity row's Go there and the campaign page's run rows. It
// follows goTarget; a job with a slot and no layer opens its variant and selects the layer
// whose slot is the job's (read from variant.get), else shows the variant. A run row knows no
// names, so its parts are taken as there. Sends no job.markSeen and opens no file.
import type { NavStore } from '@/renderer/stores/nav-store'
import type { AdmanApi } from '@/shared/schemas/api'
import type { JobPlace } from '@/shared/schemas/queries/activity'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { JobRow } from '@/shared/schemas/rows/job'
import { goTarget, goThere, type GoTarget } from './go-there'

const PRESENT: JobPlace = { campaignName: '', variantLabel: '', layerName: '' }

export async function resultTarget(
  api: AdmanApi,
  projectId: string,
  job: JobRow,
  place: JobPlace = PRESENT,
): Promise<GoTarget | null> {
  const target = goTarget(job, place)
  if (target?.to !== 'variant' || job.slot === null || job.layerId !== null) return target
  const read = await api.query('variant.get', { projectId, variantId: target.variantId })
  const layers = read.ok ? ((read.data as VariantGet | null)?.layers ?? []) : []
  const layer = layers.find((l) => l.slot === job.slot)
  return layer ? { ...target, to: 'layer', layerId: layer.id } : target
}

export async function showResult(
  api: AdmanApi,
  nav: NavStore,
  projectId: string,
  job: JobRow,
  place?: JobPlace,
): Promise<void> {
  const target = await resultTarget(api, projectId, job, place)
  if (target) goThere(nav.getState(), projectId, target)
}
