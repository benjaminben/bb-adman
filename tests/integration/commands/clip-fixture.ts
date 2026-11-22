// Test helper for the clip commands (P7-9): a project with one campaign from the starter
// template, the clip handlers with the real asset service, and assets whose files are real
// files beside the project file. Not a test file itself.
import fs from 'node:fs'
import path from 'node:path'
import { makeAssetBus } from '../assets/asset-bus'
import { testDeps, TEST_NOW } from '../campaigns/campaign-deps'
import { createInput } from '../campaigns/campaign-fixture'
import { createAssetService } from '@/main/assets/service'
import { campaignCommands } from '@/main/commands/campaign'
import { clipCommands } from '@/main/commands/clip'
import { layerCommands } from '@/main/commands/layer'
import { variantCommands } from '@/main/commands/variant'
import { readWireRow } from '@/main/db/rows'
import { mp4File } from '@/main/providers/fake/mp4'
import type { Actor } from '@/shared/schemas/events'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export { TEST_NOW }
export type ClipBus = Awaited<ReturnType<typeof makeClipBus>>

type AssetSpec = {
  id: string
  kind?: AssetRow['kind']
  mime?: string
  library?: AssetRow['library']
  origin?: AssetRow['origin']
  // A video's stored facts; null leaves the columns empty (a row made before Phase 7).
  facts?: { width: number | null; height: number | null; durationMs: number | null } | null
  // The file's bytes; null makes no file (a missing asset).
  bytes?: Uint8Array | null
}

export const video = (durationMs: number) =>
  mp4File({ width: 640, height: 360, durationMs, sound: false })

export async function makeClipBus() {
  const deps = testDeps({ assets: createAssetService() })
  const bus = makeAssetBus([
    ...campaignCommands(deps),
    ...layerCommands(deps),
    ...variantCommands(deps),
    ...clipCommands(deps),
  ])
  await bus.user('campaign.create', createInput())
  const { id: variantId } = bus.db.prepare('SELECT id FROM variant ORDER BY id LIMIT 1').get() as {
    id: string
  }
  bus.db.prepare('UPDATE variant SET duration_ms = 8000 WHERE id = ?').run(variantId)
  const folder = path.dirname(bus.project.filePath)
  const exec = (actor: Actor) => (name: string, input: Record<string, unknown>) =>
    bus.bus.execute(name, { projectId: bus.projectId, ...input }, { actor })

  function addAsset(spec: AssetSpec): void {
    const kind = spec.kind ?? 'image'
    const mime = spec.mime ?? (kind === 'video' ? 'video/mp4' : 'image/png')
    const ext = mime.split('/')[1] ?? 'bin'
    const file = path.join(folder, `${spec.id}.${ext}`)
    const bytes =
      spec.bytes === undefined ? (kind === 'video' ? video(5000) : new Uint8Array(8)) : spec.bytes
    if (bytes) fs.writeFileSync(file, bytes)
    const facts =
      spec.facts === undefined
        ? kind === 'video'
          ? { width: 640, height: 360, durationMs: 5000 }
          : { width: 100, height: 100, durationMs: null }
        : (spec.facts ?? { width: null, height: null, durationMs: null })
    bus.db
      .prepare(
        `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
          mime, byte_size, mtime_ms, content_hash, width, height, duration_ms, created_at)
         VALUES (?, ?, ?, ?, 'linked', ?, ?, ?, ?, 10, 1, 'h', ?, ?, ?, 'x')`,
      )
      .run(
        spec.id,
        spec.library ?? 'asset',
        kind,
        spec.origin ?? 'imported',
        `${spec.id}.${ext}`,
        file,
        path.basename(file),
        mime,
        facts.width,
        facts.height,
        facts.durationMs,
      )
  }

  const clips = (id = variantId): BackgroundClipRow[] =>
    (
      bus.db
        .prepare('SELECT id FROM background_clip WHERE variant_id = ? ORDER BY start_ms, id')
        .all(id) as Array<{ id: string }>
    ).map((r) => readWireRow(bus.db, 'background_clip', { id: r.id }) as BackgroundClipRow)

  return {
    ...bus,
    deps,
    variantId,
    addAsset,
    clips,
    clip: (id: string) => readWireRow(bus.db, 'background_clip', { id }) as BackgroundClipRow,
    asset: (id: string) => readWireRow(bus.db, 'asset', { id }) as AssetRow,
    variant: (id = variantId) => readWireRow(bus.db, 'variant', { id }) as VariantRow,
    agent: exec('agent'),
    add: (over: Record<string, unknown>) =>
      exec('user')('clip.add', { variantId, assetId: 'P1', ...over }),
    history: (direction: 'undo' | 'redo') =>
      exec('user')(`history.${direction}`, { scope: `variant:${variantId}` }),
    undoState: () => bus.undo.state(bus.projectId, `variant:${variantId}`),
    clearUndo: () => {
      while (bus.undo.takeUndo(bus.projectId, `variant:${variantId}`));
    },
  }
}

// The clip ID a successful add answered with.
export const clipIdOf = (result: unknown): string =>
  (result as { data: { clipId: string } }).data.clipId
