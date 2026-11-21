// spec/phases/phase-06.md, design addition 1: translation.forCampaign, every translation of a
// campaign and the newest translation job per direction and language. Both actors may read it.
import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import type { JobStatus } from '@/shared/config/job-kinds'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export const translationForCampaignInput = projectScoped
  .extend({ campaignId: z.string().min(1) })
  .strict()
export type TranslationForCampaignInput = z.infer<typeof translationForCampaignInput>

// One text layer of a variant not in the primary language. Ordered by direction sort, then
// language, then size label, then layer z.
export type TranslationRow = {
  directionId: string
  variantId: string
  title: string
  sizeLabel: string
  language: string
  layerId: string
  layerKey: string
  layerName: string
  sourceText: string | null // the direction master's copy for this key; null when it has none
  text: string // the layer's copy ('' when null)
  status: LayerRow['translationStatus']
  source: LayerRow['translationSource']
  fontAssetId: string | null
}

// The newest translation job per direction and language.
export type TranslationJobState = {
  directionId: string
  language: string
  jobId: string
  status: JobStatus
  errorKind: JobRow['errorKind'] // as job rows give it; the window shows the plain sentence
}

export type TranslationForCampaign = {
  primaryLanguage: string
  rows: TranslationRow[]
  jobs: TranslationJobState[]
}
