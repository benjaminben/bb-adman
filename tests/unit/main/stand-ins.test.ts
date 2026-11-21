import { describe, it, expect } from 'vitest'
import { createAssetServiceStandIn } from '../../../src/main/assets/stand-in'
import { createJobServiceStandIn } from '../../../src/main/jobs/stand-in'
import type { ProjectHandle } from '../../../src/main/db/project-file'
import type { ProjectContext } from '../../../src/main/commands/types'

const project = {} as ProjectHandle

describe('AssetService stand-in [SPEC 14, step 0]', () => {
  it('reports no missing assets', async () => {
    expect(await createAssetServiceStandIn().missingAssetIds(project)).toEqual([])
  })

  it('throws on writeManaged and read until slice A builds them', async () => {
    const assets = createAssetServiceStandIn()
    await expect(
      assets.writeManaged(project, { assetId: 'a1', ext: 'png', bytes: new Uint8Array() }),
    ).rejects.toThrow()
    await expect(assets.read(project, 'a1')).rejects.toThrow()
  })
})

describe('JobService stand-in [SPEC 14, step 0]', () => {
  it('throws on enqueue and counts no active job', () => {
    const jobs = createJobServiceStandIn()
    expect(() =>
      jobs.enqueue({} as ProjectContext, {
        kind: 'image_generation',
        campaignId: null,
        variantId: null,
        layerId: null,
        slot: 'background',
        provider: 'fake',
        model: 'm',
        request: {},
      }),
    ).toThrow()
    expect(jobs.activeCount('p1')).toBe(0)
  })
})
