// Test helper for P5-9 (spec/links-and-sync.md, "Generative fill"): a campaign whose master
// background names picture A1, fanned out to 9x16 (fill) and 16x9 (scale) in en and de, and
// a finished generative_fill job J1 on the 9x16 en variant whose result is asset F1. Not a
// test file itself.
import { expectChanges } from '../expect-changes'
import { testDeps } from '../campaigns/campaign-deps'
import { createInput, SQUARE, TALL } from '../campaigns/campaign-fixture'
import { makeBusFixture } from '../commands/test-bus'
import { layersOf } from '../links/linked-fixture'
import { WIDE } from '../links/fan-out-fixture'
import { campaignCommands } from '@/main/commands/campaign'
import { layerCommands } from '@/main/commands/layer'
import { variantCommands } from '@/main/commands/variant'
import { generationApplyFill } from '@/main/commands/generation/apply-fill'
import type { Actor } from '@/shared/schemas/events'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export type FillBus = Awaited<ReturnType<typeof makeFillBus>>

const ASSET_COLUMNS = `(id, library, kind, origin, storage, display_name, abs_path, rel_path,
  mime, byte_size, mtime_ms, content_hash, created_at, width, height)`

export async function makeFillBus() {
  const deps = testDeps()
  const f = makeBusFixture([
    ...campaignCommands(deps),
    ...layerCommands(deps),
    ...variantCommands(deps),
    generationApplyFill(deps),
  ])
  const db = f.projects.requireOpen(f.projectId).db
  const exec = (actor: Actor) => (name: string, input: Record<string, unknown>) =>
    f.bus.execute(name, { projectId: f.projectId, ...input }, { actor })
  await exec('user')('campaign.create', { ...createInput(), sizes: [SQUARE, TALL, WIDE] })
  const direction = db
    .prepare('SELECT id, campaign_id AS campaignId, master_variant_id AS masterId FROM direction')
    .get() as { id: string; campaignId: string; masterId: string }
  for (const [id, path] of [
    ['A1', '/x/a.png'],
    ['F1', '/x/f.png'],
  ]) {
    db.prepare(
      `INSERT INTO asset ${ASSET_COLUMNS} VALUES (?, 'asset', 'image', 'imported', 'linked',
        'a.png', ?, 'a.png', 'image/png', 1, 1, ?, 'x', 1000, 1000)`,
    ).run(id, path, id)
  }
  db.prepare(
    `UPDATE layer SET source = '{"assetId":"A1"}' WHERE variant_id = ? AND type = 'background'`,
  ).run(direction.masterId)
  await exec('user')('variant.fanOut', {
    directionId: direction.id,
    sizes: [TALL.label, WIDE.label],
    languages: ['en', 'de'],
    formats: ['image'],
    fits: { [TALL.label]: 'fill', [WIDE.label]: 'scale' },
  })
  const campaignScope = `campaign:${direction.campaignId}`
  // The fan-out's own entry is not what these tests undo.
  f.undo.clear(f.projectId, campaignScope)
  const at = (sizeLabel: string, language: string): string =>
    (
      db
        .prepare('SELECT id FROM variant WHERE size_label = ? AND language = ? AND id != ?')
        .get(sizeLabel, language, direction.masterId) as { id: string }
    ).id
  const background = (variantId: string) =>
    layersOf(db, variantId).find((l) => l.type === 'background') as LayerRow
  const tallEn = at(TALL.label, 'en')
  const addJob = (id: string, over: { kind?: string; status?: string; result?: unknown } = {}) =>
    db
      .prepare(
        `INSERT INTO job (id, kind, status, campaign_id, variant_id, layer_id, provider, model,
          request, result, paid_calls, started_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'fake', 'm', ?, ?, 0, 'user', 'x', 'x')`,
      )
      .run(
        id,
        over.kind ?? 'generative_fill',
        over.status ?? 'succeeded',
        direction.campaignId,
        tallEn,
        background(tallEn).id,
        JSON.stringify({
          prompt: 'p',
          sourceAssetId: 'A1',
          placement: { x: 0, y: 420, width: 1080, height: 1080 },
          width: TALL.width,
          height: TALL.height,
        }),
        'result' in over ? JSON.stringify(over.result) : JSON.stringify({ assetIds: ['F1'] }),
      )
  addJob('J1')
  return {
    ...f,
    db,
    campaignScope,
    masterId: direction.masterId,
    tallEn,
    tallDe: at(TALL.label, 'de'),
    wideEn: at(WIDE.label, 'en'),
    background,
    addJob,
    user: exec('user'),
    agent: exec('agent'),
    rev: (id: string) =>
      (db.prepare('SELECT rev FROM variant WHERE id = ?').get(id) as { rev: number }).rev,
    changed: (run: () => Promise<unknown>) =>
      expectChanges({ db, events: f.events, projectId: f.projectId }, run),
  }
}
