// Test helper for P5-4 (spec/links-and-sync.md, "Adding back and removing variants"): a
// project with one campaign from the starter template, plus a second variant V2 written by
// hand in the same direction at 9x16, with copies of the master's layers, one subject, one
// picture layer, one clip and a check row. Not a test file itself.
import { expectChanges } from '../expect-changes'
import { testDeps } from '../campaigns/campaign-deps'
import { createInput, TALL } from '../campaigns/campaign-fixture'
import { makeBusFixture } from '../commands/test-bus'
import { campaignCommands } from '@/main/commands/campaign'
import { subjectCommands } from '@/main/commands/subject'
import { ruleSetCommands } from '@/main/commands/rule-set'
import { layerCommands } from '@/main/commands/layer'
import { variantCommands } from '@/main/commands/variant'
import type { PermissionRequest } from '@/main/commands/bus'
import { readWireRow } from '@/main/db/rows'
import type { Actor } from '@/shared/schemas/events'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export const V2 = 'V2'
export type VariantBus = Awaited<ReturnType<typeof makeVariantBus>>

export async function makeVariantBus() {
  const asked: PermissionRequest[] = []
  const deps = testDeps()
  const f = makeBusFixture(
    [
      ...campaignCommands(deps),
      ...subjectCommands(deps),
      ...ruleSetCommands(deps),
      ...layerCommands(deps),
      ...variantCommands(deps),
    ],
    async (req) => {
      asked.push(req)
      return false
    },
  )
  const db = f.projects.requireOpen(f.projectId).db
  const exec = (actor: Actor) => (name: string, input: Record<string, unknown>) =>
    f.bus.execute(name, { projectId: f.projectId, ...input }, { actor })
  await exec('user')('campaign.create', createInput())
  const direction = db
    .prepare('SELECT id, campaign_id, master_variant_id FROM direction')
    .get() as {
    id: string
    campaign_id: string
    master_variant_id: string
  }
  addVariant(db, direction.master_variant_id, V2)
  const campaignScope = `campaign:${direction.campaign_id}`
  return {
    ...f,
    db,
    asked,
    masterId: direction.master_variant_id,
    directionId: direction.id,
    campaignId: direction.campaign_id,
    user: exec('user'),
    agent: exec('agent'),
    variant: (id: string) => readWireRow(db, 'variant', { id }) as VariantRow | null,
    changed: (run: () => Promise<unknown>) =>
      expectChanges({ db, events: f.events, projectId: f.projectId }, run),
    history: (direction: 'undo' | 'redo', scope = campaignScope) =>
      exec('user')(`history.${direction}`, { scope }),
    undoState: (scope = campaignScope) => f.undo.state(f.projectId, scope),
    campaignScope,
  }
}

// A second variant beside the master, written by hand: the master's row at 9x16, copies of
// its layers with IDs `{id}-{n}`, one more picture layer naming asset A1, one subject, one
// clip naming A1 and a check row.
export function addVariant(
  db: import('better-sqlite3').Database,
  masterId: string,
  id: string,
  sizeLabel = TALL.label,
) {
  db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
      mime, byte_size, mtime_ms, content_hash, created_at)
     VALUES ('A1', 'asset', 'image', 'imported', 'linked', 'a.png', '/x/a.png', 'a.png',
      'image/png', 1, 1, 'h', 'x') ON CONFLICT DO NOTHING`,
  ).run()
  db.prepare(
    `INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
      duration_ms, duration_overridden, rev, created_by, created_at, agent_changed_at)
     SELECT ?, direction_id, 'Tall', ?, ?, ?, language, format, duration_ms, 1, 7, 'agent',
      created_at, 'then' FROM variant WHERE id = ?`,
  ).run(id, TALL.width, TALL.height, sizeLabel, masterId)
  const columns = `type, slot, name, z, visible, locked, linked, overrides, copy, style, geometry,
    source, timing, animation, revs, synced_revs, translation_status, translation_source, overflow`
  db.prepare(
    `INSERT INTO layer (id, variant_id, key, ${columns})
     SELECT ? || '-' || z, ?, key, ${columns} FROM layer WHERE variant_id = ?`,
  ).run(id, id, masterId)
  db.prepare(
    `INSERT INTO layer (id, variant_id, key, type, slot, name, z, overrides, copy, style,
      geometry, source, timing, animation, revs, synced_revs)
     SELECT ? || '-pic', ?, 'pic', 'image', NULL, 'Picture', 50, '["geometry"]', NULL, style,
      geometry, '{"assetId":"A1"}', timing, animation, revs, synced_revs
     FROM layer WHERE variant_id = ? AND type = 'background'`,
  ).run(id, id, masterId)
  db.prepare(
    `INSERT INTO variant_subject (variant_id, subject_id)
     SELECT ?, subject_id FROM variant_subject WHERE variant_id = ? LIMIT 1`,
  ).run(id, masterId)
  db.prepare(
    `INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms, placement)
     VALUES (? || '-clip', ?, 'A1', 0, 0, 1000, NULL)`,
  ).run(id, id)
  db.prepare(
    `INSERT INTO variant_check (variant_id, checked_rev, ran_at, ran_by, results)
     VALUES (?, 7, 'x', 'user', '[]')`,
  ).run(id)
}
