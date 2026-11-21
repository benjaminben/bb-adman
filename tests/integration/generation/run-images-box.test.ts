// OI-70 (spec/api-commands.md, generation.runImages, "The shape asked for"): a run for a layer
// asks for the layer's box; a run for a slot keeps the variant's size.
import { afterEach, describe, expect, it } from 'vitest'
import {
  makeGenerationFixture,
  BACKGROUND_LAYER,
  VARIANT,
  type GenerationFixture,
} from './generation-fixture'
import { data } from '../core-fixture'

let f: GenerationFixture
afterEach(() => f.cleanup())

const IMAGE_LAYER = 'l-image'
const base = { variantId: VARIANT, prompt: 'A bottle', referenceAssetIds: [], count: 1 }

function setBox(id: string, width: number, height: number) {
  const geometry = { x: 10, y: 20, width, height, rotation: 0, crop: null }
  f.db.prepare('UPDATE layer SET geometry = ? WHERE id = ?').run(JSON.stringify(geometry), id)
}

function addImageLayer() {
  f.db.exec(`
    INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
      timing, animation, revs, synced_revs)
    SELECT '${IMAGE_LAYER}', variant_id, '${IMAGE_LAYER}', 'image', NULL, 'Picture', 1, NULL,
      style, geometry, NULL, timing, animation, revs, synced_revs
    FROM layer WHERE id = '${BACKGROUND_LAYER}'
  `)
}

async function requestSize(input: Record<string, unknown>) {
  const r = await f.user('generation.runImages', { ...base, provider: 'fake', ...input })
  const { jobId } = data<{ jobId: string }>(r)
  const request = f.job(jobId)?.request as { width: number; height: number }
  return { width: request.width, height: request.height }
}

describe('generation.runImages asks for the layer box [OI-70]', () => {
  it.each([
    [
      'an image layer 400 × 200 gives that size',
      IMAGE_LAYER,
      400,
      200,
      { width: 400, height: 200 },
    ],
    ['a background its own box', BACKGROUND_LAYER, 1000, 800, { width: 1000, height: 800 }],
    ['a box with fractions is rounded', IMAGE_LAYER, 399.6, 200.4, { width: 400, height: 200 }],
    ['a box under one pixel asks for at least 1', IMAGE_LAYER, 0.2, 0, { width: 1, height: 1 }],
  ])('%s', async (_name, layerId, width, height, expected) => {
    f = await makeGenerationFixture()
    addImageLayer()
    setBox(layerId, width, height)
    expect(await requestSize({ layerId })).toEqual(expected)
  })

  it("a slot keeps the variant's size", async () => {
    f = await makeGenerationFixture()
    setBox(BACKGROUND_LAYER, 400, 200)
    expect(await requestSize({ slot: 'background' })).toEqual({ width: 1080, height: 1350 })
  })
})
