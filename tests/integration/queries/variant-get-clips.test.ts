// P7-9: variant.get gives the variant's clips by startMs, then ID, and their assets; a clip's
// missing file sets the missingFile badge.
import fs from 'node:fs'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { testDeps } from '../campaigns/campaign-deps'
import { clipIdOf, makeClipBus, type ClipBus } from '../commands/clip-fixture'
import { createAssetService } from '@/main/assets/service'
import type { CoreDeps } from '@/main/core-deps'
import { variantQueries } from '@/main/queries/variant'
import type { VariantGet } from '@/shared/schemas/queries/variant'

let bus: ClipBus
beforeEach(async () => {
  bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  bus.addAsset({ id: 'V1', kind: 'video' })
})
afterEach(() => bus.cleanup())

async function get(): Promise<VariantGet> {
  const deps = testDeps({
    projects: bus.projects,
    assets: createAssetService(),
    log: { write: () => undefined } as unknown as CoreDeps['log'],
  })
  const query = variantQueries(deps)['variant.get']
  const input = { projectId: bus.projectId, variantId: bus.variantId }
  return (await query?.(input, { actor: 'user' })) as VariantGet
}

describe('variant.get clips [P7-9]', () => {
  it('gives the clips by startMs, then ID, and each clip asset once', async () => {
    const late = clipIdOf(await bus.add({ assetId: 'V1', startMs: 6000 }))
    const early = clipIdOf(await bus.add({ startMs: 0, lengthMs: 1000 }))
    const again = clipIdOf(await bus.add({ startMs: 2000, lengthMs: 1000 }))
    const result = await get()
    expect(result.clips).toEqual([bus.clip(early), bus.clip(again), bus.clip(late)])
    const clipAssets = result.assets.filter((a) => a.id === 'P1' || a.id === 'V1')
    expect(clipAssets).toEqual([
      { ...bus.asset('P1'), missing: false },
      { ...bus.asset('V1'), missing: false },
    ])
    const ids = result.assets.map((a) => a.id)
    expect(ids).toEqual([...ids].sort())
  })

  it('gives no clips and no clip assets for an empty track', async () => {
    const result = await get()
    expect(result.clips).toEqual([])
    expect(result.assets.map((a) => a.id)).not.toContain('P1')
  })

  it('sets missingFile when a clip asset file is missing', async () => {
    await bus.add({ assetId: 'V1' })
    expect((await get()).variant.badges.missingFile).toBe(false)
    fs.rmSync(bus.asset('V1').absPath)
    const result = await get()
    expect(result.variant.badges.missingFile).toBe(true)
    expect(result.assets.find((a) => a.id === 'V1')?.missing).toBe(true)
  })
})
