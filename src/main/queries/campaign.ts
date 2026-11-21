// The campaign query domain (SPEC 12, 4.3; SPEC 14, slice C). campaign.get: the campaign row,
// its subjects, rule set, directions, every variant with its badges, and the campaign's job
// marks [1.42]. It carries no layers; they are read here only to work out the badges.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { badgesOf, directionsOf, jobMarks, openFor, requireCampaign } from './campaign-reads'
import type { ActivityLog } from '@/main/log/activity-log'
import { masterOf } from '@/main/links/master-of'
import {
  campaignScopedInput,
  type CampaignCover,
  type CampaignGet,
  type VariantSummary,
} from '@/shared/schemas/queries/campaign'
import type { CampaignSubjectRow } from '@/shared/schemas/rows/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { RuleSetRow } from '@/shared/schemas/rows/rule-set'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { VariantRow, VariantSubjectRow } from '@/shared/schemas/rows/variant'

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// By the direction's order, the master first inside a direction, then createdAt, then ID.
function orderedVariants(
  db: Database.Database,
  directions: DirectionRow[],
  log: ActivityLog,
): VariantRow[] {
  const all = readWireRows(db, 'variant', log) as VariantRow[]
  return directions.flatMap((d) =>
    all
      .filter((v) => v.directionId === d.id)
      .sort(
        (a, b) =>
          Number(b.id === d.masterVariantId) - Number(a.id === d.masterVariantId) ||
          a.createdAt.localeCompare(b.createdAt) ||
          byId(a.id, b.id),
      ),
  )
}

function subjectsOf(db: Database.Database, campaignId: string, log: ActivityLog): SubjectRow[] {
  const ids = new Set(
    (readWireRows(db, 'campaign_subject', log) as CampaignSubjectRow[])
      .filter((cs) => cs.campaignId === campaignId)
      .map((cs) => cs.subjectId),
  )
  return (readWireRows(db, 'subject', log) as SubjectRow[])
    .filter((s) => ids.has(s.id))
    .sort((a, b) => byId(a.id, b.id))
}

export function campaignGet(deps: Pick<CoreDeps, 'projects' | 'assets' | 'log'>): QueryFn {
  return async (raw): Promise<CampaignGet> => {
    const { input, project } = openFor(deps, campaignScopedInput, raw)
    const db = project.db
    const campaign = requireCampaign(db, input.campaignId)
    const ruleSet = readWireRow(db, 'rule_set', { campaignId: campaign.id }) as RuleSetRow | null
    // A broken file: the runner answers INTERNAL and logs this line, which holds no data.
    if (!ruleSet) throw new Error('campaign.get: the campaign has no rule_set row')
    const directions = directionsOf(db, campaign.id)
    const masters = new Map(directions.map((d) => [d.id, d.masterVariantId]))
    // Each direction's master is read once per call [spec/links-and-sync.md, "Follow rules"].
    const masterRows = new Map(directions.map((d) => [d.id, masterOf(db, d.id)]))
    const missing = new Set(await deps.assets.missingAssetIds(project))
    const layers = readWireRows(db, 'layer', deps.log) as LayerRow[]
    const links = readWireRows(db, 'variant_subject', deps.log) as VariantSubjectRow[]
    const variants = orderedVariants(db, directions, deps.log).map((v): VariantSummary => ({
      ...v,
      isMaster: masters.get(v.directionId) === v.id,
      subjectIds: links
        .filter((l) => l.variantId === v.id)
        .map((l) => l.subjectId)
        .sort(byId),
      badges: badgesOf(
        db,
        v,
        layers.filter((l) => l.variantId === v.id),
        missing,
        masterRows.get(v.directionId) ?? null,
      ),
    }))
    return {
      campaign,
      subjects: subjectsOf(db, campaign.id, deps.log),
      ruleSet,
      directions,
      variants,
      marks: jobMarks(db, 'campaign_id', campaign.id),
    }
  }
}

// spec/editor.md, "Thumbnails on the screens": the master of the first direction and its rev,
// or null when the campaign has no direction or its master row is gone.
export function campaignCover(db: Database.Database, campaignId: string): CampaignCover | null {
  const first = directionsOf(db, campaignId)[0]
  if (!first) return null
  const row = db
    .prepare<[string], { rev: number }>('SELECT rev FROM variant WHERE id = ?')
    .get(first.masterVariantId)
  return row ? { variantId: first.masterVariantId, rev: row.rev } : null
}

export function campaignQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'campaign.get': campaignGet(deps) }
}
