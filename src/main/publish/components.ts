// The components of a publish (spec/phases/phase-09.md "Components", A-222, A-223): every asset
// of the asset library that a layer (`source.assetId`, `style.fontAssetId`) or a background clip
// of an exported variant uses, listed once. Folder, first match: logos (in the rule set's
// required list), subjects/{subjectId} (a ULID, else on down the list), fonts, backgrounds (a
// background layer or a clip), images. A file that is missing or unfit is listed with its
// problem and has no upload path. Every value comes from a project file that may come from
// anyone: JSON is read with care, IDs are checked, and paths come only from paths.ts.
import type Database from 'better-sqlite3'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRows } from '@/main/db/rows'
import { componentPath, isUlid } from '@/shared/publish/paths'
import type { PublishComponent, PublishComponentFolder } from '@/shared/schemas/queries/publish'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { checkComponentFile, isComponentKind, type ComponentKind } from './component-file'

// remotePath is relative to the campaign folder; null when the file is not uploaded (a problem,
// or a font not allowed to be shared). absPath is the checked file, null with a problem.
export type CollectedComponent = PublishComponent & {
  remotePath: string | null
  absPath: string | null
}

type Use = { background: boolean; font: boolean }

const FOLDER_ORDER: PublishComponentFolder[] = [
  'logos',
  'subjects',
  'fonts',
  'backgrounds',
  'images',
]

function parsed(text: unknown): unknown {
  if (typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function assetIdIn(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null) return null
  const id = (value as Record<string, unknown>)[key]
  return typeof id === 'string' ? id : null
}

// The variants are joined to their campaign, so an ID of another campaign uses nothing.
const IN_CAMPAIGN = `JOIN variant v ON v.id = x.variant_id JOIN direction d ON d.id = v.direction_id
  WHERE d.campaign_id = ? AND v.id IN (SELECT value FROM json_each(?))`

function usesOf(db: Database.Database, campaignId: string, variantIds: string[]): Map<string, Use> {
  const uses = new Map<string, Use>()
  const add = (id: string | null, use: Partial<Use>) => {
    if (id === null) return
    const old = uses.get(id) ?? { background: false, font: false }
    uses.set(id, { background: old.background || !!use.background, font: old.font || !!use.font })
  }
  const ids = JSON.stringify(variantIds)
  const layers = db
    .prepare(`SELECT x.type, x.source, x.style FROM layer x ${IN_CAMPAIGN}`)
    .all(campaignId, ids) as Array<{ type: unknown; source: unknown; style: unknown }>
  for (const l of layers) {
    add(assetIdIn(parsed(l.source), 'assetId'), { background: l.type === 'background' })
    add(assetIdIn(parsed(l.style), 'fontAssetId'), { font: true })
  }
  const clips = db
    .prepare(`SELECT x.asset_id FROM background_clip x ${IN_CAMPAIGN}`)
    .all(campaignId, ids) as Array<{ asset_id: unknown }>
  for (const c of clips)
    add(typeof c.asset_id === 'string' ? c.asset_id : null, { background: true })
  return uses
}

function requiredOf(db: Database.Database, campaignId: string): Set<string> {
  const row = db
    .prepare('SELECT required_asset_ids FROM rule_set WHERE campaign_id = ?')
    .get(campaignId) as { required_asset_ids: unknown } | undefined
  const list = parsed(row?.required_asset_ids)
  return new Set(Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : [])
}

function folderOf(row: AssetRow, kind: ComponentKind, use: Use, required: Set<string>) {
  if (required.has(row.id)) return 'logos'
  if (isUlid(row.subjectId)) return 'subjects'
  if (kind === 'font') return 'fonts'
  return use.background ? 'backgrounds' : 'images'
}

async function componentOf(
  handle: ProjectHandle,
  row: AssetRow,
  use: Use,
  required: Set<string>,
): Promise<CollectedComponent> {
  // A row of another kind (text, sound) is listed as the kind its use asks for, unfit.
  const kind = isComponentKind(row.kind) ? row.kind : use.font ? 'font' : 'image'
  const folder = folderOf(row, kind, use, required)
  const shareAllowed = kind === 'font' ? row.fontPublishAllowed : null
  const checked = await checkComponentFile(handle, row)
  const base = { assetId: row.id, displayName: row.displayName, kind, folder, shareAllowed }
  if ('problem' in checked) {
    return {
      ...base,
      localPath: row.absPath,
      problem: checked.problem,
      remotePath: null,
      absPath: null,
    }
  }
  // The share rule holds for every font, whichever folder it is in.
  const remotePath =
    shareAllowed === false
      ? null
      : componentPath({
          folder,
          subjectId: folder === 'subjects' ? row.subjectId : null,
          displayName: row.displayName,
          assetId: row.id,
          ext: checked.ext,
        })
  return {
    ...base,
    localPath: checked.absPath,
    problem: null,
    remotePath,
    absPath: checked.absPath,
  }
}

const order = (a: CollectedComponent, b: CollectedComponent) =>
  FOLDER_ORDER.indexOf(a.folder) - FOLDER_ORDER.indexOf(b.folder) ||
  a.displayName.localeCompare(b.displayName) ||
  (a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0)

export async function collectComponents(
  handle: ProjectHandle,
  input: { campaignId: string; variantIds: string[] },
): Promise<CollectedComponent[]> {
  const uses = usesOf(handle.db, input.campaignId, input.variantIds)
  const required = requiredOf(handle.db, input.campaignId)
  const rows = (readWireRows(handle.db, 'asset') as AssetRow[]).filter(
    (r) => r.library === 'asset' && uses.has(r.id),
  )
  const list = await Promise.all(
    rows.map((r) => componentOf(handle, r, uses.get(r.id) as Use, required)),
  )
  return list.sort(order)
}
