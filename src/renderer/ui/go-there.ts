// "Go there" (spec/screens-ai.md, "The activity panel") [REQ: FR-217]: where a job's row leads,
// and the one action that shows it through the nav store. A job with a layer opens the campaign
// tab and the variant tab and selects the layer; a gone layer, or a slot with no layer, leads
// to the variant; a gone variant, or a job for the campaign alone, to the campaign overview; a
// brief reading to the Project tab; a gone campaign has nowhere to go. A video job follows the
// same rule (R2E-6): its layer, else its variant, where the timeline is. A part is gone when
// the job holds its ID but the query found no name for it. Sends no job.markSeen.
import { OVERVIEW_TAB, PROJECT_TAB, type NavStoreState } from '@/renderer/stores/nav-store'
import type { JobPlace } from '@/shared/schemas/queries/activity'
import type { JobRow } from '@/shared/schemas/rows/job'

export type GoTarget =
  | { to: 'layer'; campaignId: string; variantId: string; layerId: string }
  | { to: 'variant'; campaignId: string; variantId: string }
  | { to: 'campaign'; campaignId: string }
  | { to: 'project' }

export function goTarget(job: JobRow, place: JobPlace): GoTarget | null {
  if (job.kind === 'brief_extraction') return { to: 'project' }
  const { campaignId, variantId, layerId } = job
  if (campaignId === null || place.campaignName === null) return null
  if (variantId === null || place.variantLabel === null) return { to: 'campaign', campaignId }
  if (layerId === null || place.layerName === null) return { to: 'variant', campaignId, variantId }
  return { to: 'layer', campaignId, variantId, layerId }
}

export function goThere(nav: NavStoreState, projectId: string, target: GoTarget): void {
  if (target.to === 'project') {
    nav.showCampaign(projectId, PROJECT_TAB)
    return
  }
  nav.openCampaign(projectId, target.campaignId)
  if (target.to === 'campaign') {
    nav.showVariant(projectId, target.campaignId, OVERVIEW_TAB)
    return
  }
  nav.openVariant(projectId, target.campaignId, target.variantId)
  if (target.to === 'layer')
    nav.setView(projectId, target.variantId, { selectedLayerId: target.layerId })
}
