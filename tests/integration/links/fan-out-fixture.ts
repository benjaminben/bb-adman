// Test helper for P5-10 (spec/links-and-sync.md, "Fan-out"): a project with one campaign at
// three sizes (1x1 master, 9x16, 16x9) and two languages (en master, de), the master's
// background naming a 1000x1000 picture A1. Not a test file itself.
import { expectChanges } from '../expect-changes'
import { testDeps } from '../campaigns/campaign-deps'
import { noKeyDeps } from '../translation/no-key-deps'
import { createInput, SQUARE, TALL } from '../campaigns/campaign-fixture'
import { makeBusFixture } from '../commands/test-bus'
import { layersOf } from './linked-fixture'
import { campaignCommands } from '@/main/commands/campaign'
import { subjectCommands } from '@/main/commands/subject'
import { ruleSetCommands } from '@/main/commands/rule-set'
import { variantCommands } from '@/main/commands/variant'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { Actor } from '@/shared/schemas/events'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export const WIDE = { label: '16x9', width: 1920, height: 1080 }
export type FanOutBus = Awaited<ReturnType<typeof makeFanOutBus>>

export async function makeFanOutBus() {
  const deps = testDeps(noKeyDeps())
  const f = makeBusFixture([
    ...campaignCommands(deps),
    ...subjectCommands(deps),
    ...ruleSetCommands(deps),
    ...variantCommands(deps),
  ])
  const project = f.projects.requireOpen(f.projectId)
  const db = project.db
  const exec = (actor: Actor) => (name: string, input: Record<string, unknown>) =>
    f.bus.execute(name, { projectId: f.projectId, ...input }, { actor })
  await exec('user')('campaign.create', { ...createInput(), sizes: [SQUARE, TALL, WIDE] })
  const direction = db
    .prepare('SELECT id, campaign_id AS campaignId, master_variant_id AS masterId FROM direction')
    .get() as { id: string; campaignId: string; masterId: string }
  db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
      mime, byte_size, mtime_ms, content_hash, created_at, width, height)
     VALUES ('A1', 'asset', 'image', 'imported', 'linked', 'a.png', '/x/a.png', 'a.png',
      'image/png', 1, 1, 'h', 'x', 1000, 1000)`,
  ).run()
  db.prepare(
    `UPDATE layer SET source = '{"assetId":"A1"}' WHERE variant_id = ? AND type = 'background'`,
  ).run(direction.masterId)
  const campaignScope = `campaign:${direction.campaignId}`
  const variants = () =>
    (readWireRows(db, 'variant') as VariantRow[]).filter((v) => v.id !== direction.masterId)
  return {
    ...f,
    project,
    db,
    masterId: direction.masterId,
    directionId: direction.id,
    campaignId: direction.campaignId,
    user: exec('user'),
    agent: exec('agent'),
    master: () => readWireRow(db, 'variant', { id: direction.masterId }) as VariantRow,
    variants,
    at: (sizeLabel: string, language: string) =>
      variants().find((v) => v.sizeLabel === sizeLabel && v.language === language),
    layers: (variantId: string) => layersOf(db, variantId),
    subjects: (variantId: string) =>
      (
        db
          .prepare('SELECT subject_id AS id FROM variant_subject WHERE variant_id = ? ORDER BY 1')
          .all(variantId) as Array<{ id: string }>
      ).map((r) => r.id),
    changed: (run: () => Promise<unknown>) =>
      expectChanges({ db, events: f.events, projectId: f.projectId }, run),
    history: (step: 'undo' | 'redo') => exec('user')(`history.${step}`, { scope: campaignScope }),
  }
}
