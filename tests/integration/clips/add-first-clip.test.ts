// P7-9: addFirstClip (spec/phases/phase-07.md, "Clips and the track", OI-20, A-180), for
// variant.setFormat (P7-10) and fan-out (P7-23): the first clip from the background's picture,
// only when first_clip_made is 0, the track is empty and the background has a usable source.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { makeAssetBus } from '../assets/asset-bus'
import { testDeps, TEST_NOW } from '../campaigns/campaign-deps'
import { createInput } from '../campaigns/campaign-fixture'
import { campaignCommands } from '@/main/commands/campaign'
import { defineCommand } from '@/main/commands/types'
import { addFirstClip } from '@/main/clips/write-clip'
import { readWireRow } from '@/main/db/rows'
import type { VariantRow } from '@/shared/schemas/rows/variant'

const firstClip = defineCommand({
  name: 'test.firstClip',
  input: z.object({ projectId: z.string(), variantId: z.string() }),
  projectId: (input) => input.projectId,
  run: (ctx, input) => ({ data: { clipId: addFirstClip(ctx, input.variantId, TEST_NOW) } }),
})

let bus: ReturnType<typeof makeAssetBus>
let variantId: string
beforeEach(async () => {
  bus = makeAssetBus([...campaignCommands(testDeps()), firstClip])
  await bus.user('campaign.create', createInput())
  variantId = (bus.db.prepare('SELECT id FROM variant LIMIT 1').get() as { id: string }).id
  bus.db.prepare('UPDATE variant SET duration_ms = 6000 WHERE id = ?').run(variantId)
  bus.db
    .prepare(
      `INSERT INTO asset (id, library, kind, origin, storage, display_name, abs_path, rel_path,
        mime, byte_size, mtime_ms, content_hash, created_at)
       VALUES (?, ?, 'image', 'imported', 'linked', 'p.png', '/x', 'x', 'image/png', 1, 1, 'h', 'x')`,
    )
    .run('P1', 'asset')
  setSource('P1')
})
afterEach(() => bus.cleanup())

function setSource(assetId: string | null): void {
  const source = assetId ? JSON.stringify({ assetId }) : null
  bus.db
    .prepare("UPDATE layer SET source = ? WHERE variant_id = ? AND type = 'background'")
    .run(source, variantId)
}

const run = async () =>
  ((await bus.user('test.firstClip', { variantId })) as { data: { clipId: string | null } }).data
    .clipId
const variant = () => readWireRow(bus.db, 'variant', { id: variantId }) as VariantRow
const clips = () =>
  bus.db.prepare('SELECT asset_id, start_ms, in_ms, out_ms FROM background_clip').all()

describe('addFirstClip [OI-20, A-180]', () => {
  it('makes a clip of the background picture to the variant end and sets first_clip_made', async () => {
    const rev = variant().rev
    expect(await run()).toEqual(expect.any(String))
    expect(clips()).toEqual([{ asset_id: 'P1', start_ms: 0, in_ms: 0, out_ms: 6000 }])
    expect(variant()).toMatchObject({ firstClipMade: true, rev: rev + 1 })
  })

  it('makes none a second time, even when the track was emptied', async () => {
    await run()
    bus.db.prepare('DELETE FROM background_clip').run()
    expect(await run()).toBeNull()
    expect(clips()).toEqual([])
  })

  it('makes none when the track already has a clip', async () => {
    await run()
    bus.db.prepare('UPDATE variant SET first_clip_made = 0').run()
    expect(await run()).toBeNull()
    expect(clips()).toHaveLength(1)
  })

  it('makes none when the background has no source', async () => {
    setSource(null)
    expect(await run()).toBeNull()
    expect(variant().firstClipMade).toBe(false)
  })

  it('makes none when the source is not a usable picture', async () => {
    bus.db.prepare("UPDATE asset SET library = 'reference' WHERE id = 'P1'").run()
    expect(await run()).toBeNull()
    setSource('NOPE')
    expect(await run()).toBeNull()
    expect(clips()).toEqual([])
  })

  it('makes none for a variant that is not there', async () => {
    expect(
      ((await bus.user('test.firstClip', { variantId: 'gone' })) as { data: unknown }).data,
    ).toEqual({ clipId: null })
  })
})
