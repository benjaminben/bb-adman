import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import {
  makeGenerationFixture,
  ended,
  waitFor,
  VARIANT,
  type GenerationFixture,
} from './generation-fixture'
import { data } from '../core-fixture'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import { plainMessage } from '@/main/providers/messages'
import { PROVIDER_ERROR_KINDS } from '@/shared/schemas/queries/app'
import { generationDetailsOf } from '../../fixtures/png-chunks'

let f: GenerationFixture
afterEach(() => {
  resetFakeBehaviour()
  f.cleanup()
})

const start = async (count: number) =>
  data<{ jobId: string }>(
    await f.user('generation.runImages', {
      variantId: VARIANT,
      slot: 'background',
      prompt: 'A bottle on a rock',
      referenceAssetIds: [],
      count,
      provider: 'fake',
    }),
  ).jobId

describe('Phase 2 exit: generation.runImages with the fake provider, through the app core [SPEC 14 Phase 2]', () => {
  it('gives a succeeded job with its campaign, variant and slot, and the asked number of PNGs with a generation chunk', async () => {
    f = await makeGenerationFixture()
    const jobId = await start(3)
    await waitFor(ended(f, jobId))
    const row = f.job(jobId)
    expect(row).toMatchObject({
      status: 'succeeded',
      campaignId: 'c1',
      variantId: VARIANT,
      slot: 'background',
      paidCalls: 0,
    })
    const { assetIds } = row?.result as { assetIds: string[] }
    expect(assetIds).toHaveLength(3)
    expect(f.toPngCalls).toHaveLength(3)
    for (const assetId of assetIds) {
      const file = path.join(f.assetsDir(), `${assetId}.png`)
      expect(generationDetailsOf(fs.readFileSync(file))).toMatchObject({
        app: 'Adman',
        provider: 'fake',
        kind: 'image_generation',
      })
      expect(f.asset(assetId)).toMatchObject({ origin: 'generated', genRunId: jobId })
    }
    expect(f.events.some((e) => e.name === 'project.changed')).toBe(true)
  })

  for (const kind of PROVIDER_ERROR_KINDS) {
    it(`gives a failed job of kind ${kind} with its plain message when every call fails`, async () => {
      f = await makeGenerationFixture()
      setFakeBehaviour({ fail: kind })
      const jobId = await start(2)
      await waitFor(ended(f, jobId))
      expect(f.job(jobId)).toMatchObject({ status: 'failed', errorKind: kind })
      expect(plainMessage(kind, 'Fake provider').length).toBeGreaterThan(0)
      expect(f.jobs().length).toBe(1)
      expect(fs.existsSync(f.assetsDir()) ? fs.readdirSync(f.assetsDir()) : []).toEqual([])
    })
  }
})
