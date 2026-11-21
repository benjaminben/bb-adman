// What the export report reads from the project and the settings (spec/phases/phase-08.md
// "Report"). Only the named fields are copied: no asset path, no settings but the exporter's
// name, no provider address, so nothing the report must not hold can reach it (A-196).
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { campaignVariantIds } from '@/main/checks/read-input'
import { readSnapshot } from '@/main/links/snapshot'
import { requireCampaign } from '@/main/queries/campaign-reads'
import { paidCount } from '@/main/queries/paid-count'
import type { PaidCount } from '@/shared/schemas/queries/paid-count'
import { Report, type ReportVariant } from '@/shared/schemas/report'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { VariantSnapshot } from '@/shared/schemas/links'

type ReportAsset = ReportVariant['assets'][number]

export type FactVariant = {
  id: string
  title: string
  sizeLabel: string
  language: string
  format: 'image' | 'video'
  rev: number
  agentChangedAt: string | null
  subjectIds: string[]
  textLayers: Array<{
    key: string
    translationSource: LayerRow['translationSource']
    translationStatus: LayerRow['translationStatus']
  }>
  assets: ReportAsset[]
}

export type ReportFacts = {
  campaign: {
    id: string
    name: string
    region: string
    audience: string
    primaryLanguage: string
    languages: string[]
    sizeLabels: string[]
  }
  subjects: Array<{ subjectId: string; displayName: string }>
  // Every ad of the campaign, by direction order then ID.
  variants: FactVariant[]
  // The newest report row's body (A-199); null when there is none or it fails the schema.
  previous: Report | null
  reportCount: number
  paidCount: PaidCount
  exporterName: string
  appVersion: string
}

// The generation fields of a generated asset only; never its path.
function reportAsset(asset: AssetRow, role: ReportAsset['role']): ReportAsset {
  const base = { assetId: asset.id, displayName: asset.displayName, role, origin: asset.origin }
  if (asset.origin !== 'generated') return base
  return {
    ...base,
    ...(asset.genProvider !== null && { provider: asset.genProvider }),
    ...(asset.genModel !== null && { model: asset.genModel }),
    ...(asset.genPrompt !== null && { prompt: asset.genPrompt }),
  }
}

// Each asset the ad's layers and (for a video ad) clips use, once per role, in z order.
function assetsUsed(db: Database.Database, snapshot: VariantSnapshot): ReportAsset[] {
  const uses: Array<[string, ReportAsset['role']]> = []
  for (const layer of snapshot.layers) {
    if (layer.source && layer.type !== 'text') uses.push([layer.source.assetId, layer.type])
    if ('fontAssetId' in layer.style && layer.style.fontAssetId) {
      uses.push([layer.style.fontAssetId, 'font'])
    }
  }
  if (snapshot.variant.format === 'video') {
    for (const clip of snapshot.clips) uses.push([clip.assetId, 'clip'])
  }
  const seen = new Set<string>()
  return uses.flatMap(([id, role]) => {
    if (seen.has(`${role}:${id}`)) return []
    seen.add(`${role}:${id}`)
    const asset = readWireRow(db, 'asset', { id }) as AssetRow | null
    return asset ? [reportAsset(asset, role)] : []
  })
}

function factVariant(db: Database.Database, snapshot: VariantSnapshot): FactVariant {
  const { variant } = snapshot
  return {
    id: variant.id,
    title: variant.title,
    sizeLabel: variant.sizeLabel,
    language: variant.language,
    format: variant.format,
    rev: variant.rev,
    agentChangedAt: variant.agentChangedAt,
    subjectIds: snapshot.subjectIds,
    textLayers: snapshot.layers
      .filter((l) => l.type === 'text')
      .map((l) => ({
        key: l.key,
        translationSource: l.translationSource,
        translationStatus: l.translationStatus,
      })),
    assets: assetsUsed(db, snapshot),
  }
}

function previousReport(db: Database.Database, campaignId: string): Report | null {
  const row = db
    .prepare(
      'SELECT body FROM report WHERE campaign_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
    )
    .get(campaignId) as { body: string } | undefined
  if (!row) return null
  try {
    const parsed = Report.safeParse(JSON.parse(row.body))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

// Throws NOT_FOUND when the campaign is not in the project.
export function reportFacts(
  deps: Pick<CoreDeps, 'projects' | 'settings' | 'appVersion'>,
  project: ProjectHandle,
  campaignId: string,
): ReportFacts {
  const { db } = project
  const campaign = requireCampaign(db, campaignId)
  const variants = campaignVariantIds(db, campaignId).flatMap((id) => {
    const snapshot = readSnapshot(db, id)
    return snapshot ? [factVariant(db, snapshot)] : []
  })
  const subjectIds = [...new Set(variants.flatMap((v) => v.subjectIds))].sort()
  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM report WHERE campaign_id = ?')
    .get(campaignId) as { count: number }
  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      region: campaign.region,
      audience: campaign.audience,
      primaryLanguage: campaign.primaryLanguage,
      languages: campaign.languages,
      sizeLabels: campaign.sizes.map((s) => s.label),
    },
    subjects: subjectIds.map((subjectId) => {
      const subject = readWireRow(db, 'subject', { id: subjectId }) as SubjectRow | null
      return { subjectId, displayName: subject?.name ?? subjectId }
    }),
    variants,
    previous: previousReport(db, campaignId),
    reportCount: count,
    paidCount: paidCount(deps)(
      { projectId: project.projectId, campaignId },
      { actor: 'user' },
    ) as PaidCount,
    exporterName: deps.settings.get().reports.exporterName,
    appVersion: deps.appVersion,
  }
}
