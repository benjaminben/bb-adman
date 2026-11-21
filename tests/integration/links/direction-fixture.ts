// Test helper for P5-11 (spec/links-and-sync.md, "Directions"): the variant fixture's project
// (a campaign from the starter template, its master and V2 in "Direction 1") on a bus that
// also holds the direction commands. The master gets one subject and one clip, so a copy can
// be checked for both. Not a test file itself.
import { expectChanges } from '../expect-changes'
import { testDeps } from '../campaigns/campaign-deps'
import { createInput } from '../campaigns/campaign-fixture'
import { makeBusFixture } from '../commands/test-bus'
import { campaignCommands } from '@/main/commands/campaign'
import { directionCommands } from '@/main/commands/direction'
import { layerCommands } from '@/main/commands/layer'
import { variantCommands } from '@/main/commands/variant'
import { readWireRow } from '@/main/db/rows'
import type { Actor } from '@/shared/schemas/events'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import { addVariant, V2 } from './variant-fixture'

export type DirectionBus = Awaited<ReturnType<typeof makeDirectionBus>>

export async function makeDirectionBus() {
  const deps = testDeps()
  const f = makeBusFixture([
    ...campaignCommands(deps),
    ...layerCommands(deps),
    ...variantCommands(deps),
    ...directionCommands(deps),
  ])
  const project = f.projects.requireOpen(f.projectId)
  const db = project.db
  const exec = (actor: Actor) => (name: string, input: Record<string, unknown>) =>
    f.bus.execute(name, { projectId: f.projectId, ...input }, { actor })
  await exec('user')('campaign.create', createInput())
  const first = db.prepare('SELECT * FROM direction').get() as {
    id: string
    campaign_id: string
    master_variant_id: string
  }
  const masterId = first.master_variant_id
  addVariant(db, masterId, V2)
  db.prepare(
    `INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms, placement)
     VALUES ('M-clip', ?, 'A1', 0, 0, 500, NULL)`,
  ).run(masterId)
  const campaignScope = `campaign:${first.campaign_id}`
  return {
    ...f,
    project,
    db,
    masterId,
    directionId: first.id,
    campaignId: first.campaign_id,
    user: exec('user'),
    agent: exec('agent'),
    direction: (id: string) => readWireRow(db, 'direction', { id }) as DirectionRow | null,
    changed: (run: () => Promise<unknown>) =>
      expectChanges({ db, events: f.events, projectId: f.projectId }, run),
    history: (direction: 'undo' | 'redo') =>
      exec('user')(`history.${direction}`, { scope: campaignScope }),
    undoState: (scope = campaignScope) => f.undo.state(f.projectId, scope),
  }
}
