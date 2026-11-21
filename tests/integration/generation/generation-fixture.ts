// Test harness for slice H through the real core (SPEC 10.2): a project with a campaign on
// the starter template, a 1080 by 1350 master variant with a background layer and a text
// layer, the fake provider, and a toPng stand-in. Not a test file itself. No key is ever
// saved here, so no real provider can be reached.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type Database from 'better-sqlite3'
import { createCore, type Core } from '@/main/core'
import type { BusEvent } from '@/main/commands/bus'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { greyPng } from '@/main/providers/fake/png'
import { fakeCrypto, data } from '../core-fixture'
import { insertCampaign } from '../row-fixtures'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { AssetRow } from '@/shared/schemas/rows/asset'

const REVS = JSON.stringify({ copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 })
const GEOMETRY = JSON.stringify({ x: 0, y: 0, width: 10, height: 10, rotation: 0, crop: null })
const BLOCK = { preset: 'none', startMs: 0, durationMs: 0 }
const ANIMATION = JSON.stringify({ entrance: BLOCK, exit: BLOCK })
const TIMING = JSON.stringify({ startMs: 0, endMs: null })
const TEXT_STYLE = JSON.stringify({
  fontAssetId: null,
  fontSize: 40,
  fontWeight: 400,
  color: '#000000',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
})

export const VARIANT = 'v1'
export const OTHER_VARIANT = 'v2'
export const BACKGROUND_LAYER = 'l-bg'
export const TEXT_LAYER = 'l-text'
export const OTHER_LAYER = 'l-other'

function insertLayer(
  db: Database.Database,
  row: { id: string; variantId: string; type: string; slot: string | null },
): void {
  const text = row.type === 'text'
  db.prepare(
    `INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
      timing, animation, revs, synced_revs)
     VALUES (?, ?, ?, ?, ?, 'L', 0, ?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.variantId,
    row.id,
    row.type,
    row.slot,
    text ? 'Hello' : null,
    text ? TEXT_STYLE : JSON.stringify({ opacity: 1 }),
    GEOMETRY,
    TIMING,
    ANIMATION,
    REVS,
    REVS,
  )
}

export function seed(db: Database.Database): void {
  insertCampaign(db, 'c1')
  db.exec(`
    UPDATE campaign SET template_id = 'starter' WHERE id = 'c1';
    INSERT INTO direction (id, campaign_id, name, master_variant_id, sort)
      VALUES ('d1', 'c1', 'D', '${VARIANT}', 0);
    INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
      duration_ms, created_by, created_at)
      VALUES ('${VARIANT}', 'd1', 'Master', 1080, 1350, '4:5', 'en', 'image', 0, 'user', 'x'),
             ('${OTHER_VARIANT}', 'd1', 'Other', 1080, 1080, '1:1', 'en', 'image', 0, 'user', 'x');
  `)
  insertLayer(db, {
    id: BACKGROUND_LAYER,
    variantId: VARIANT,
    type: 'background',
    slot: 'background',
  })
  insertLayer(db, { id: TEXT_LAYER, variantId: VARIANT, type: 'text', slot: 'headline' })
  insertLayer(db, { id: OTHER_LAYER, variantId: OTHER_VARIANT, type: 'image', slot: null })
}

export type GenerationFixtureOptions = {
  toPng?: (bytes: Uint8Array) => Uint8Array
  appVersion?: string
  now?: () => Date
}

export async function makeGenerationFixture(opts: GenerationFixtureOptions = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-gen-'))
  const events: BusEvent[] = []
  const toPngCalls: Uint8Array[] = []
  const core: Core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: root,
    appVersion: opts.appVersion ?? '0.1.0',
    crypto: fakeCrypto(),
    env: { ADMAN_FAKE_PROVIDERS: '1' },
    emit: (e) => events.push(e),
    askPermission: async () => false,
    ...(opts.now ? { now: opts.now } : {}),
    toPng: (bytes) => {
      toPngCalls.push(bytes)
      return (opts.toPng ?? ((b) => b))(bytes)
    },
  })
  const user = (name: string, input: Record<string, unknown>) =>
    core.bus.execute(name, { projectId, ...input }, { actor: 'user' })
  const created = await core.bus.execute(
    'project.create',
    { name: 'P', location: root },
    { actor: 'user' },
  )
  const projectId = data<{ projectId: string }>(created).projectId
  const project = core.projects.requireOpen(projectId)
  seed(project.db)

  return {
    core,
    root,
    events,
    toPngCalls,
    projectId,
    project,
    db: project.db,
    user,
    // Imports a real picture file by link and gives its asset ID.
    async importPicture(name = 'ref.png', bytes: Uint8Array = greyPng(5, 5)): Promise<string> {
      const file = path.join(root, name)
      fs.writeFileSync(file, bytes)
      const r = await user('asset.import', { paths: [file], library: 'reference', copy: false })
      const [id] = data<{ assetIds: string[] }>(r).assetIds
      if (!id) throw new Error('import gave no asset')
      return id
    },
    job: (id: string) => readWireRow(project.db, 'job', { id }) as JobRow | null,
    jobs: () => readWireRows(project.db, 'job') as JobRow[],
    asset: (id: string) => readWireRow(project.db, 'asset', { id }) as AssetRow | null,
    assetsDir: () => core.deps.assets.assetsDir(project),
    cleanup() {
      core.closeAll()
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

export type GenerationFixture = Awaited<ReturnType<typeof makeGenerationFixture>>

export async function waitFor(check: () => boolean, ms = 3_000): Promise<void> {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('waitFor: timed out')
    await new Promise((r) => setTimeout(r, 5))
  }
}

export const ended = (f: GenerationFixture, id: string) => () => {
  const status = f.job(id)?.status
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}
