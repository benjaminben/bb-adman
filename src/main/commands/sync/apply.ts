// sync.apply (spec/links-and-sync.md, "Sync"; FR-082, FR-083): writes the accepted master
// changes to a direction's variants. Agent policy deny. Takes choices only: every value it
// writes comes from the plan worked out from the database now (A-137), never from the input.
// One campaign entry, whose inverse is variant.restoreLayers with each changed variant's layers
// before the apply; the changed variants' own lists are cleared (A-141).
import { isDeepStrictEqual } from 'node:util'
import type Database from 'better-sqlite3'
import { ulid } from 'ulid'
import { defineCommand, type HandlerResult, type ProjectContext } from '@/main/commands/types'
import { insertLayerRow } from '@/main/commands/campaign/layer-row'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import type { CoreDeps } from '@/main/core-deps'
import { readWireRow, storedJson } from '@/main/db/rows'
import { readLayers } from '@/main/links/snapshot'
import { pictureSizesOf } from '@/main/queries/sync'
import { withSyncTexts } from '@/main/translation/sync-result'
import { GROUPS } from '@/shared/links/follow-rules'
import { syncWritesOf, type SyncPlanInput, type VariantWrites } from '@/shared/links/sync-plan'
import { syncApplyInput, type SyncApplyReply } from '@/shared/schemas/commands/sync'
import { AppError } from '@/shared/schemas/result'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

const MASTER_CHANGED = 'The master changed after the review opened. Look at the changes again.'

// The patch keys a sync writes and their columns, from a fixed list.
const COLUMNS: Record<string, string> = {
  copy: 'copy',
  style: 'style',
  geometry: 'geometry',
  source: 'source',
  timing: 'timing',
  animation: 'animation',
  overrides: 'overrides',
  syncedRevs: 'synced_revs',
  translationStatus: 'translation_status',
  translationSource: 'translation_source',
}
const JSON_KEYS = new Set([
  'style',
  'geometry',
  'source',
  'timing',
  'animation',
  'overrides',
  'syncedRevs',
])

type Plan = { direction: DirectionRow; masterRev: number; input: SyncPlanInput }

// The direction's master and other variants as the file holds them, each read whole.
function planInputOf(db: Database.Database, directionId: string): Plan {
  const direction = readWireRow(db, 'direction', { id: directionId }) as DirectionRow | null
  if (!direction) throw new AppError('NOT_FOUND', 'That direction was not found.')
  const variantOf = (id: string) => readWireRow(db, 'variant', { id }) as VariantRow | null
  const master = variantOf(direction.masterVariantId)
  // A broken file: the runner answers INTERNAL and logs this line, which holds no data.
  if (!master) throw new Error('sync.apply: the direction has no master row')
  const ids = db
    .prepare('SELECT id FROM variant WHERE direction_id = ? AND id != ? ORDER BY created_at, id')
    .all(direction.id, master.id) as Array<{ id: string }>
  const variants = ids.flatMap(({ id }) => {
    const row = variantOf(id)
    return row ? [{ row, layers: readLayers(db, id) }] : []
  })
  const masterLayers = readLayers(db, master.id)
  return {
    direction,
    masterRev: master.rev,
    input: {
      master: { row: master, layers: masterLayers },
      variants,
      pictureSizes: pictureSizesOf(db, masterLayers),
    },
  }
}

const stored = (key: string, value: unknown): unknown =>
  JSON_KEYS.has(key) ? storedJson('layer', key, value) : value

// One planned update: the patch's columns, and one counter per group whose value really
// changed (spec/editor-commands.md, "Layer counters").
function updateLayer(ctx: ProjectContext, row: LayerRow, patch: Record<string, unknown>) {
  const keys = Object.keys(patch).filter((k) => k in COLUMNS)
  const revs = { ...row.revs }
  for (const g of GROUPS) {
    if (g in patch && !isDeepStrictEqual(patch[g], row[g])) revs[g] += 1
  }
  const columns = [...keys.map((k) => `"${COLUMNS[k]}" = ?`), 'revs = ?'].join(', ')
  const values = [...keys.map((k) => stored(k, patch[k])), storedJson('layer', 'revs', revs)]
  ctx.project.db.prepare(`UPDATE layer SET ${columns} WHERE id = ?`).run(...values, row.id)
  ctx.changes.touch('layer', { id: row.id })
}

function writeVariant(ctx: ProjectContext, w: VariantWrites, before: LayerRow[]) {
  const db = ctx.project.db
  const byId = new Map(before.map((l) => [l.id, l]))
  for (const { layerId, patch } of w.updates) {
    const row = byId.get(layerId)
    if (row) updateLayer(ctx, row, patch)
  }
  for (const layerId of w.removes) {
    db.prepare('DELETE FROM layer WHERE id = ?').run(layerId)
    ctx.changes.touch('layer', { id: layerId })
  }
  for (const planned of w.adds) {
    insertLayerRow(ctx, { ...planned, id: ulid(), variantId: w.variantId })
  }
}

export function syncApply(deps: CoreDeps) {
  return defineCommand({
    name: 'sync.apply',
    input: syncApplyInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<SyncApplyReply> {
      const db = ctx.project.db
      const { direction, masterRev, input: plan } = planInputOf(db, input.directionId)
      if (masterRev !== input.masterRev) {
        throw new AppError('RULE_VIOLATION', MASTER_CHANGED, { reason: 'master_changed' })
      }
      // Throws INVALID_INPUT for a choice with no planned change, before any write.
      // P6-16: an accepted translated copy takes the newest sync job's text when it may be used.
      const writes = withSyncTexts(db, direction.id, plan, syncWritesOf(plan, input.decisions))
      const variantIds = writes.map((w) => w.variantId)
      if (writes.length === 0) return { data: { variantIds } }
      const now = deps.now().toISOString()
      const layersBefore = new Map(plan.variants.map((v) => [v.row.id, v.layers]))
      const earlier = writes.map((w) => {
        const layers = layersBefore.get(w.variantId) ?? []
        writeVariant(ctx, w, layers)
        bumpVariantRev(ctx, w.variantId, now)
        return { variantId: w.variantId, layers }
      })
      const call = {
        name: 'variant.restoreLayers',
        input: { projectId: input.projectId, variants: earlier },
      }
      const campaignId = direction.campaignId
      return {
        data: { variantIds },
        log: { campaignId },
        inverse: { scope: `campaign:${campaignId}`, call },
        clearScopes: variantIds.map((id) => `variant:${id}`),
      }
    },
  })
}
