// SPEC 4.4: one wire row schema per table. rows.ts checks every row it reads against the
// schema of its table. background_clip, report and variant_check come with Phases 7, 8, 6.
import type { z } from 'zod'
import type { TableName } from './keys'
import { AssetRow } from './asset'
import { CampaignRow, CampaignSubjectRow } from './campaign'
import { DirectionRow } from './direction'
import { JobRow } from './job'
import { LayerRow } from './layer'
import { ProjectMetaRow } from './project-meta'
import { RuleSetRow } from './rule-set'
import { SubjectRow } from './subject'
import { VariantRow, VariantSubjectRow } from './variant'

export const ROW_SCHEMAS: Partial<Record<TableName, z.ZodType<Record<string, unknown>>>> = {
  project_meta: ProjectMetaRow,
  subject: SubjectRow,
  asset: AssetRow,
  campaign: CampaignRow,
  campaign_subject: CampaignSubjectRow,
  rule_set: RuleSetRow,
  direction: DirectionRow,
  variant: VariantRow,
  variant_subject: VariantSubjectRow,
  layer: LayerRow,
  job: JobRow,
}
