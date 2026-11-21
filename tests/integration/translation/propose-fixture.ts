// Test helper for P6-6 (spec/phases/phase-06.md, design addition 2): the real core with the
// fake provider, a campaign from the starter template (en primary, de), and beside its master,
// written by hand: two linked German variants D1 and D2 and a linked French one F1; a second
// direction dir-2 with its own master M2 and a linked German variant X1. Every text layer of
// the four is a `missing` translation. Not a test file itself.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCore, type Core } from '@/main/core'
import type { BusEvent } from '@/main/commands/bus'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { resetFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { fakeCrypto, data } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { addLinkedVariant, copyRow, layersOf, linkedLayerId } from '../links/linked-fixture'

export type ProposeFixture = Awaited<ReturnType<typeof makeProposeFixture>>

// Puts a stand-in row in the provider table in place of the fake's, or beside it.
function standIn(core: Core, change: Partial<ProviderInfo>, replace: boolean): void {
  const providers = core.deps.providers
  const at = providers.findIndex((p) => p.id === 'fake')
  const fake = providers[at]
  if (!fake) throw new Error('no fake provider row')
  if (replace) providers.splice(at, 1, { ...fake, ...change })
  else providers.push({ ...fake, ...change })
}

export async function makeProposeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-propose-'))
  const events: BusEvent[] = []
  const core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: root,
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: { ADMAN_FAKE_PROVIDERS: '1' },
    emit: (e) => events.push(e),
    askPermission: async () => false,
  })
  const made = await core.bus.execute(
    'project.create',
    { name: 'P', location: root },
    { actor: 'user' },
  )
  const projectId = data<{ projectId: string }>(made).projectId
  const exec = (actor: 'user' | 'agent') => (name: string, input: Record<string, unknown>) =>
    core.bus.execute(name, { projectId, ...input }, { actor })
  const user = exec('user')
  data(await user('campaign.create', createInput()))
  const db = core.projects.requireOpen(projectId).db
  const direction = db
    .prepare('SELECT id, campaign_id, master_variant_id FROM direction')
    .get() as {
    id: string
    campaign_id: string
    master_variant_id: string
  }
  const masterId = direction.master_variant_id
  // A second text layer on the master, so a job has more than one item.
  const first = db
    .prepare("SELECT id FROM layer WHERE variant_id = ? AND type = 'text' ORDER BY z")
    .get(masterId) as { id: string }
  const top = db.prepare('SELECT max(z) AS z FROM layer WHERE variant_id = ?').get(masterId) as {
    z: number
  }
  copyRow(db, 'layer', first.id, { id: 'master-tagline', key: 'tagline', z: top.z + 1 })
  db.prepare("UPDATE layer SET slot = NULL, copy = 'Shop now' WHERE id = 'master-tagline'").run()
  for (const id of ['D1', 'D2']) addLinkedVariant(db, masterId, id, { language: 'de' })
  addLinkedVariant(db, masterId, 'F1', { language: 'fr' })
  copyRow(db, 'direction', direction.id, { id: 'dir-2', name: 'Direction 2', sort: 1 })
  addLinkedVariant(db, masterId, 'M2')
  db.prepare("UPDATE layer SET linked = 0, synced_revs = revs WHERE variant_id = 'M2'").run()
  addLinkedVariant(db, 'M2', 'X1', { language: 'de' })
  db.prepare("UPDATE variant SET direction_id = 'dir-2' WHERE id IN ('M2', 'X1')").run()
  db.prepare("UPDATE direction SET master_variant_id = 'M2' WHERE id = 'dir-2'").run()
  db.prepare(
    `UPDATE layer SET translation_status = 'missing', translation_source = NULL
     WHERE type = 'text' AND variant_id IN ('D1', 'D2', 'F1', 'X1')`,
  ).run()
  const masterText = layersOf(db, masterId)
    .filter((l) => l.type === 'text' && (l.copy ?? '').trim() !== '')
    .sort((a, b) => a.z - b.z)
  const textKeys = masterText.map((l) => l.key)
  const masterLayers = new Map(masterText.map((l) => [l.key, l.id]))
  const layer = (id: string) => readWireRow(db, 'layer', { id }) as LayerRow
  const job = (id: string) => readWireRow(db, 'job', { id }) as JobRow | null
  return {
    core,
    events,
    projectId,
    db,
    masterId,
    directionId: direction.id,
    campaignId: direction.campaign_id,
    textKeys,
    id: linkedLayerId,
    masterLayerId: (key: string) => masterLayers.get(key) ?? '',
    user,
    agent: exec('agent'),
    layer,
    job,
    jobs: () => readWireRows(db, 'job') as JobRow[],
    ended(id: string): boolean {
      const status = job(id)?.status
      return status === 'succeeded' || status === 'failed' || status === 'cancelled'
    },
    errorDetail: (id: string) =>
      (db.prepare('SELECT error_detail FROM job WHERE id = ?').get(id) as { error_detail: string })
        .error_detail,
    setRow: (id: string, set: Record<string, string | number | null>) => {
      const columns = Object.keys(set).map((c) => `"${c}" = ?`)
      db.prepare(`UPDATE layer SET ${columns.join(', ')} WHERE id = ?`).run(
        ...Object.values(set),
        id,
      )
    },
    // The fake, counted as a paid provider.
    paidFake: () => standIn(core, { local: false }, true),
    // A provider row beside the fake's that needs a key no one has stored.
    addKeyedProvider: () =>
      standIn(core, { id: 'keyed', label: 'Keyed', secrets: ['gemini.apiKey'] }, false),
    readLogs: () => {
      const dir = path.join(root, 'userData', 'logs')
      if (!fs.existsSync(dir)) return ''
      return fs
        .readdirSync(dir)
        .map((n) => fs.readFileSync(path.join(dir, n), 'utf8'))
        .join('')
    },
    cleanup() {
      resetFakeBehaviour()
      core.closeAll()
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

export async function waitFor(check: () => boolean, ms = 3_000): Promise<void> {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('waitFor: timed out')
    await new Promise((r) => setTimeout(r, 5))
  }
}
