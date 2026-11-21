// Test helper for P6-4 (spec/phases/phase-06.md, design addition 2): a campaign from the
// starter template (languages en and de, en the primary one) on a bus with the layer and
// translation commands. Beside the master, written by hand: two linked German variants D1 and
// D2 and a linked French variant F1, in the master's direction, plus a German variant X1 in a
// second direction. Not a test file itself.
import { expectChanges } from '../expect-changes'
import { testDeps } from '../campaigns/campaign-deps'
import { createInput } from '../campaigns/campaign-fixture'
import { makeBusFixture } from '../commands/test-bus'
import { addLinkedVariant, copyRow, linkedLayerId } from '../links/linked-fixture'
import { campaignCommands } from '@/main/commands/campaign'
import { layerCommands } from '@/main/commands/layer'
import { translationCommands } from '@/main/commands/translation'
import { readWireRow } from '@/main/db/rows'
import type { Actor } from '@/shared/schemas/events'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export type TranslationBus = Awaited<ReturnType<typeof makeTranslationBus>>

export async function makeTranslationBus() {
  const deps = testDeps()
  const f = makeBusFixture([
    ...campaignCommands(deps),
    ...layerCommands(deps),
    ...translationCommands(deps),
  ])
  const project = f.projects.requireOpen(f.projectId)
  const db = project.db
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
  const masterId = direction.master_variant_id
  for (const id of ['D1', 'D2']) addLinkedVariant(db, masterId, id, { language: 'de' })
  addLinkedVariant(db, masterId, 'F1', { language: 'fr' })
  copyRow(db, 'direction', direction.id, { id: 'dir-2', name: 'Direction 2', sort: 1 })
  addLinkedVariant(db, masterId, 'X1', { language: 'de' })
  db.prepare("UPDATE variant SET direction_id = 'dir-2' WHERE id = 'X1'").run()
  db.prepare(
    `UPDATE layer SET translation_status = 'missing', translation_source = NULL
     WHERE type = 'text' AND variant_id IN ('D1', 'D2', 'F1', 'X1')`,
  ).run()
  const masterText = db
    .prepare("SELECT key FROM layer WHERE variant_id = ? AND type = 'text' ORDER BY z")
    .all(masterId) as Array<{ key: string }>
  const picture = db
    .prepare("SELECT key FROM layer WHERE variant_id = ? AND type != 'text' ORDER BY z")
    .get(masterId) as { key: string }
  const campaignScope = `campaign:${direction.campaign_id}`
  const layer = (id: string) => readWireRow(db, 'layer', { id }) as LayerRow
  return {
    ...f,
    db,
    masterId,
    directionId: direction.id,
    campaignId: direction.campaign_id,
    campaignScope,
    textKeys: masterText.map((r) => r.key),
    pictureKey: picture.key,
    id: linkedLayerId,
    masterLayerId: (key: string) =>
      (
        db.prepare('SELECT id FROM layer WHERE variant_id = ? AND key = ?').get(masterId, key) as {
          id: string
        }
      ).id,
    user: exec('user'),
    agent: exec('agent'),
    layer,
    variant: (id: string) => readWireRow(db, 'variant', { id }) as VariantRow,
    // The fields the translation commands write, read back.
    text: (id: string) => {
      const l = layer(id)
      return {
        copy: l.copy,
        translationStatus: l.translationStatus,
        translationSource: l.translationSource,
        copyRev: l.revs.copy,
        syncedCopyRev: l.syncedRevs.copy,
      }
    },
    setRow: (id: string, set: Record<string, string | number | null>) => {
      const columns = Object.keys(set).map((c) => `"${c}" = ?`)
      db.prepare(`UPDATE layer SET ${columns.join(', ')} WHERE id = ?`).run(
        ...Object.values(set),
        id,
      )
    },
    changed: (run: () => Promise<unknown>) =>
      expectChanges({ db, events: f.events, projectId: f.projectId }, run),
    history: (direction: 'undo' | 'redo', scope: string) =>
      exec('user')(`history.${direction}`, { scope }),
    undoState: (scope: string) => f.undo.state(f.projectId, scope),
  }
}
