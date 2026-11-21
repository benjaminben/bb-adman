// The campaign query domain (SPEC 12, 4.3; SPEC 14, slice C). campaign.get: the campaign row,
// its subjects, rule set, directions, every variant with its badges, and the campaign's job
// marks [1.42]. It carries no layers; they are read here only to work out the badges.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '../core-deps'
import type { QueryFn } from './types'
import { readWireRow, readWireRows } from '../db/rows'
import { directionsOf, jobMarks, openFor, requireCampaign } from './campaign-reads'
import type { ActivityLog } from '../log/activity-log'
import {
  campaignScopedInput,
  type CampaignGet,
  type VariantBadges,
  type VariantSummary,
} from '../../shared/schemas/queries/campaign'
import type { CampaignSubjectRow } from '../../shared/schemas/rows/campaign'
import type { DirectionRow } from '../../shared/schemas/rows/direction'
import type { LayerRow } from '../../shared/schemas/rows/layer'
import type { RuleSetRow } from '../../shared/schemas/rows/rule-set'
import type { SubjectRow } from '../../shared/schemas/rows/subject'
import type { VariantRow, VariantSubjectRow } from '../../shared/schemas/rows/variant'

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// SPEC 4.3 [1.42]: what Phase 2 builds. A master is never out of date, and Phase 2 makes
// only masters; checks are read from Phase 6.
function badgesOf(
  db: Database.Database,
  variantId: string,
  layers: LayerRow[],
  missing: Set<string>,
): VariantBadges {
  return {
    ...jobMarks(db, 'variant_id', variantId),
    outOfDate: false,
    overflow: layers.some((l) => l.overflow),
    translationUnapproved: layers.some(
      (l) => l.translationStatus === 'missing' || l.translationStatus === 'proposed',
    ),
    checkWarning: false,
    checkStale: false,
    missingFile: layers.some((l) => l.source !== null && missing.has(l.source.assetId)),
  }
}

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
    const masters = new Set(directions.map((d) => d.masterVariantId))
    const missing = new Set(await deps.assets.missingAssetIds(project))
    const layers = readWireRows(db, 'layer', deps.log) as LayerRow[]
    const links = readWireRows(db, 'variant_subject', deps.log) as VariantSubjectRow[]
    const variants = orderedVariants(db, directions, deps.log).map((v): VariantSummary => ({
      ...v,
      isMaster: masters.has(v.id),
      subjectIds: links
        .filter((l) => l.variantId === v.id)
        .map((l) => l.subjectId)
        .sort(byId),
      badges: badgesOf(
        db,
        v.id,
        layers.filter((l) => l.variantId === v.id),
        missing,
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

export function campaignQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'campaign.get': campaignGet(deps) }
}
