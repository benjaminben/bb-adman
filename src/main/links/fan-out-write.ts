// Shared by variant.fanOut and variant.add (spec/links-and-sync.md, "Fan-out"): reads what a new
// variant is made from, checks a size and a language against the campaign, and writes one new
// variant from its planned layers. Every row read comes from the command's own project file;
// every ID written is new.
import type Database from 'better-sqlite3'
import { ulid } from 'ulid'
import type { ProjectContext } from '@/main/commands/types'
import { newVariantId } from '@/main/commands/campaign/ids'
import { insertLayerRow } from '@/main/commands/campaign/layer-row'
import * as schema from '@/main/db/schema'
import { readWireRow } from '@/main/db/rows'
import { readLayers } from './snapshot'
import type { PlannedLayer, VariantFacts } from '@/shared/links/fan-out-plan'
import type { Size } from '@/shared/scene/background-placement'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'

export type FanOutSource = {
  directionId: string
  campaign: CampaignRow
  master: VariantRow
  masterLayers: LayerRow[]
  subjectIds: string[]
  pictureSize: Size | null
}

const NOT_IN_CAMPAIGN = "Choose sizes and languages from the campaign's lists."
const notInCampaign = () =>
  new AppError('RULE_VIOLATION', NOT_IN_CAMPAIGN, { reason: 'not_in_campaign' })

// The background picture's size from its asset row; null when there is none or it is unknown.
function pictureSizeOf(db: Database.Database, layers: LayerRow[]): Size | null {
  const assetId = layers.find((l) => l.type === 'background')?.source?.assetId
  if (!assetId) return null
  const row = db.prepare('SELECT width, height FROM asset WHERE id = ?').get(assetId) as
    { width: number | null; height: number | null } | undefined
  if (!row?.width || !row.height) return null
  return { width: row.width, height: row.height }
}

export function readFanOutSource(db: Database.Database, directionId: string): FanOutSource {
  const direction = db
    .prepare(
      'SELECT campaign_id AS campaignId, master_variant_id AS masterId FROM direction WHERE id = ?',
    )
    .get(directionId) as { campaignId: string; masterId: string } | undefined
  if (!direction) throw new AppError('NOT_FOUND', 'That direction was not found.')
  const campaign = readWireRow(db, 'campaign', { id: direction.campaignId }) as CampaignRow
  const master = readWireRow(db, 'variant', { id: direction.masterId }) as VariantRow
  const masterLayers = readLayers(db, master.id)
  const subjects = db
    .prepare('SELECT subject_id AS id FROM variant_subject WHERE variant_id = ? ORDER BY 1')
    .all(master.id) as Array<{ id: string }>
  return {
    directionId,
    campaign,
    master,
    masterLayers,
    subjectIds: subjects.map((s) => s.id),
    pictureSize: pictureSizeOf(db, masterLayers),
  }
}

// The master's own size and language always count as the campaign's.
export function sizeOf(source: FanOutSource, label: string): CampaignSize {
  const { master } = source
  if (label === master.sizeLabel) return { label, width: master.width, height: master.height }
  const size = source.campaign.sizes.find((s) => s.label === label)
  if (!size) throw notInCampaign()
  return size
}

export function refuseLanguage(source: FanOutSource, language: string): void {
  if (language !== source.master.language && !source.campaign.languages.includes(language)) {
    throw notInCampaign()
  }
}

export const sameSize = (a: Size, b: Size) => a.width === b.width && a.height === b.height

export function factsOf(size: Size, language: string): VariantFacts {
  return { width: size.width, height: size.height, language }
}

export function hasVariantAt(
  db: Database.Database,
  directionId: string,
  sizeLabel: string,
  language: string,
): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM variant WHERE direction_id = ? AND size_label = ? AND language = ?
       AND format = 'image'`,
    )
    .get(directionId, sizeLabel, language)
  return row !== undefined
}

// One new image variant: the master's title, duration and subjects, rev 0, created by the actor.
export function writeVariant(
  ctx: ProjectContext,
  source: FanOutSource,
  target: { size: CampaignSize; language: string; layers: PlannedLayer[] },
  now: string,
): string {
  const { orm, db } = ctx.project
  const { master } = source
  const id = newVariantId(db)
  orm
    .insert(schema.variant)
    .values({
      id,
      directionId: source.directionId,
      title: master.title,
      width: target.size.width,
      height: target.size.height,
      sizeLabel: target.size.label,
      language: target.language,
      format: 'image',
      durationMs: master.durationMs,
      durationOverridden: master.durationOverridden ? 1 : 0,
      rev: 0,
      createdBy: ctx.actor === 'agent' ? 'agent' : 'user',
      createdAt: now,
      agentChangedAt: ctx.actor === 'agent' ? now : null,
    })
    .run()
  ctx.changes.touch('variant', { id })
  for (const subjectId of source.subjectIds) {
    orm.insert(schema.variantSubject).values({ variantId: id, subjectId }).run()
    ctx.changes.touch('variant_subject', { variantId: id, subjectId })
  }
  for (const layer of target.layers) insertLayerRow(ctx, { ...layer, id: ulid(), variantId: id })
  return id
}
