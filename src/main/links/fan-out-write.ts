// Shared by variant.fanOut and variant.add (spec/links-and-sync.md, "Fan-out";
// spec/make-variants.md, "Making variants from a variant"): reads what a new variant is made
// from (the master, or a variant of the same direction), checks a size and a language against
// the campaign, and writes one new variant from its planned layers. Every row read comes from
// the command's own project file; every ID written is new.
import type Database from 'better-sqlite3'
import { ulid } from 'ulid'
import type { ProjectContext } from '@/main/commands/types'
import { newVariantId } from '@/main/commands/campaign/ids'
import { insertLayerRow } from '@/main/commands/campaign/layer-row'
import * as schema from '@/main/db/schema'
import { readWireRow } from '@/main/db/rows'
import { readLayers } from './snapshot'
import type { PlannedLayer, VariantFacts } from '@/shared/links/fan-out-plan'
import type { NewVariantInput } from '@/shared/links/new-variant-plan'
import type { FanOutFit } from '@/shared/schemas/links'
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
  from: VariantRow // the variant the new ones are made from; the master when none is named
  fromLayers: LayerRow[]
  fromMaster: boolean
  subjectIds: string[] // the source's
  pictureSize: Size | null // the source's background picture
}

const NOT_IN_DIRECTION = 'That variant was not found in this direction.'

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

// The named variant, only when it belongs to this direction in this project file.
function sourceRow(db: Database.Database, directionId: string, variantId: string): VariantRow {
  const row = db
    .prepare('SELECT id FROM variant WHERE id = ? AND direction_id = ?')
    .get(variantId, directionId)
  if (!row) throw new AppError('NOT_FOUND', NOT_IN_DIRECTION)
  return readWireRow(db, 'variant', { id: variantId }) as VariantRow
}

export function readFanOutSource(
  db: Database.Database,
  directionId: string,
  sourceVariantId?: string,
): FanOutSource {
  const direction = db
    .prepare(
      'SELECT campaign_id AS campaignId, master_variant_id AS masterId FROM direction WHERE id = ?',
    )
    .get(directionId) as { campaignId: string; masterId: string } | undefined
  if (!direction) throw new AppError('NOT_FOUND', 'That direction was not found.')
  const campaign = readWireRow(db, 'campaign', { id: direction.campaignId }) as CampaignRow
  const master = readWireRow(db, 'variant', { id: direction.masterId }) as VariantRow
  const masterLayers = readLayers(db, master.id)
  const fromMaster = sourceVariantId === undefined || sourceVariantId === master.id
  const from = fromMaster ? master : sourceRow(db, directionId, sourceVariantId)
  const fromLayers = fromMaster ? masterLayers : readLayers(db, from.id)
  const subjects = db
    .prepare('SELECT subject_id AS id FROM variant_subject WHERE variant_id = ? ORDER BY 1')
    .all(from.id) as Array<{ id: string }>
  return {
    directionId,
    campaign,
    master,
    masterLayers,
    from,
    fromLayers,
    fromMaster,
    subjectIds: subjects.map((s) => s.id),
    pictureSize: pictureSizeOf(db, fromLayers),
  }
}

// The master's and the source's own sizes and languages always count as the campaign's.
export function sizeOf(source: FanOutSource, label: string): CampaignSize {
  for (const own of [source.from, source.master]) {
    if (label === own.sizeLabel) return { label, width: own.width, height: own.height }
  }
  const size = source.campaign.sizes.find((s) => s.label === label)
  if (!size) throw notInCampaign()
  return size
}

export function refuseLanguage(source: FanOutSource, language: string): void {
  const own = language === source.master.language || language === source.from.language
  if (!own && !source.campaign.languages.includes(language)) throw notInCampaign()
}

export type VariantFormat = 'image' | 'video'

export const sameSize = (a: Size, b: Size) => a.width === b.width && a.height === b.height

export function factsOf(size: Size, language: string): VariantFacts {
  return { width: size.width, height: size.height, language }
}

// What planNewVariant needs for one new variant. The source is left out when it is the master:
// the master's layers are not linked, so naming it as a source would copy them unlinked. The
// campaign's stored layout breaks a tie in "Which layout".
export function planInputOf(
  source: FanOutSource,
  target: VariantFacts,
  fit: FanOutFit | undefined,
  sameSizePlan: PlannedLayer[] | null = null,
): NewVariantInput {
  const { master, from } = source
  return {
    campaign: source.campaign,
    master: factsOf(master, master.language),
    masterLayers: source.masterLayers,
    target,
    fit,
    pictureSize: source.pictureSize,
    sameSizePlan,
    layoutId: source.campaign.brief.layout ?? null,
    ...(source.fromMaster
      ? {}
      : { source: { facts: factsOf(from, from.language), layers: source.fromLayers } }),
  }
}

export function hasVariantAt(
  db: Database.Database,
  directionId: string,
  sizeLabel: string,
  language: string,
  format: VariantFormat = 'image',
): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM variant WHERE direction_id = ? AND size_label = ? AND language = ?
       AND format = ?`,
    )
    .get(directionId, sizeLabel, language, format)
  return row !== undefined
}

// One new variant (an image unless format says video): the source's title, duration, duration
// flag and subjects, rev 0, created by the actor. A video made from a video takes its sound.
export function writeVariant(
  ctx: ProjectContext,
  source: FanOutSource,
  target: {
    size: CampaignSize
    language: string
    layers: PlannedLayer[]
    format?: VariantFormat
  },
  now: string,
): string {
  const { orm, db } = ctx.project
  const { from } = source
  const format = target.format ?? 'image'
  const sound = format === 'video' && from.format === 'video'
  const id = newVariantId(db)
  orm
    .insert(schema.variant)
    .values({
      id,
      directionId: source.directionId,
      title: from.title,
      width: target.size.width,
      height: target.size.height,
      sizeLabel: target.size.label,
      language: target.language,
      format,
      durationMs: from.durationMs,
      durationOverridden: from.durationOverridden ? 1 : 0,
      ...(sound ? { sound: from.sound, soundAssetId: from.soundAssetId } : {}),
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
