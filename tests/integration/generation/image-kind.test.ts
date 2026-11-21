import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeKindFixture, pngAnswer, jpegAnswer, PAID, type KindFixture } from './kind-fixture'
import { waitFor } from './generation-fixture'
import { greyPng } from '../../../src/main/providers/fake/png'
import { pictureSize } from '../../../src/main/providers/picture-size'
import { promptToSend } from '../../../src/shared/generation/prompt'
import { generationDetailsOf, pngChunks } from '../../fixtures/png-chunks'

let f: KindFixture
afterEach(() => f.cleanup())

const done = (id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(f.job(id)?.status ?? '')
const fileOf = (assetId: string) => fs.readFileSync(path.join(f.assetsDir(), `${assetId}.png`))
const withoutText = (bytes: Uint8Array) => pngChunks(bytes).filter((c) => c.type !== 'iTXt')

describe('the image_generation job kind [SPEC 14 slice H; 6.2, 6.6]', () => {
  it('stores each picture as a generated asset with the details embedded and lists them in result', async () => {
    f = makeKindFixture()
    const id = await f.start({ count: 3 })
    await waitFor(done(id))
    const row = f.job(id)
    expect(row).toMatchObject({ status: 'succeeded', paidCalls: 3 })
    const result = row?.result as { assetIds: string[]; failures: Record<string, number> }
    expect(result.assetIds).toHaveLength(3)
    expect(result.failures).toEqual({})
    expect(f.files()).toEqual(result.assetIds.map((a) => `${a}.png`).sort())
    for (const assetId of result.assetIds) {
      expect(f.assets().find((a) => a.id === assetId)).toMatchObject({
        origin: 'generated',
        storage: 'managed',
        genRunId: id,
        genProvider: PAID.id,
        genModel: 'test-model-1',
        genPrompt: promptToSend('A bottle on a rock'),
      })
      expect(generationDetailsOf(fileOf(assetId))).toEqual({
        app: 'Adman',
        appVersion: '0.1.0',
        provider: PAID.id,
        model: 'test-model-1',
        prompt: promptToSend('A bottle on a rock'),
        kind: 'image_generation',
        createdAt: '2026-11-20T14:30:00.000Z',
      })
    }
  })

  it('calls generate once per picture with count 1, the prompt with its ending, the size and the run options', async () => {
    f = makeKindFixture()
    const id = await f.start({ count: 2 })
    await waitFor(done(id))
    expect(f.calls).toHaveLength(2)
    for (const call of f.calls) {
      expect(call.input).toMatchObject({
        prompt: promptToSend('A bottle on a rock'),
        references: [],
        width: 1080,
        height: 1350,
        count: 1,
      })
      expect(call.opts?.signal).toBeInstanceOf(AbortSignal)
      expect(typeof call.opts?.onProgress).toBe('function')
    }
  })

  it('hands each reference picture, read with AssetService.read, to every call', async () => {
    f = makeKindFixture()
    const file = path.join(f.root, 'ref.png')
    const bytes = greyPng(5, 4)
    fs.writeFileSync(file, bytes)
    const imported = await f.user('asset.import', {
      paths: [file],
      library: 'reference',
      copy: false,
    })
    const refId = (imported as { data: { assetIds: string[] } }).data.assetIds[0]
    const id = await f.start({ count: 1, referenceAssetIds: [refId] })
    await waitFor(done(id))
    expect(f.calls[0]?.input.references).toEqual([
      { bytes: new Uint8Array(bytes), mime: 'image/png' },
    ])
  })

  it('runs at most two calls at a time [SPEC 6.2; FR-063]', async () => {
    f = makeKindFixture()
    const id = await f.start({ count: 5 })
    await waitFor(done(id))
    expect(f.calls).toHaveLength(5)
    expect(f.t.maxInFlight).toBe(2)
  })

  it('ends succeeded with the pictures it got and the failures counted when some calls fail', async () => {
    f = makeKindFixture()
    f.t.answers = [pngAnswer(), 'quota', pngAnswer(), 'refused']
    const id = await f.start({ count: 4 })
    await waitFor(done(id))
    const row = f.job(id)
    expect(row).toMatchObject({ status: 'succeeded', paidCalls: 4, errorKind: null })
    expect(row?.result).toMatchObject({ failures: { quota: 1, refused: 1 } })
    expect((row?.result as { assetIds: string[] }).assetIds).toHaveLength(2)
    expect(f.assets()).toHaveLength(2)
  })

  it('ends failed with the error kind when no call gives a picture, and stores nothing', async () => {
    f = makeKindFixture()
    f.t.answers = ['bad_key', 'bad_key']
    const id = await f.start({ count: 2 })
    await waitFor(done(id))
    expect(f.job(id)).toMatchObject({ status: 'failed', errorKind: 'bad_key', paidCalls: 2 })
    expect(f.assets()).toEqual([])
    expect(f.files()).toEqual([])
  })

  it('keeps what has arrived after each picture is stored [SPEC 14 1.38 "Passed on"]', async () => {
    f = makeKindFixture()
    const id = await f.start({ count: 2 })
    await waitFor(done(id))
    const kept = f
      .jobEvents(id)
      .filter((r) => r.status === 'running')
      .map((r) => (r.result as { assetIds?: string[] } | null)?.assetIds?.length ?? 0)
    expect(kept).toContain(1)
    expect(kept).toContain(2)
  })
})

describe('every picture goes through toPng [SPEC 14 1.20 L6; 6.2 F-05]', () => {
  it('one picture that toPng refuses, of three: succeeded, two assets, one other failure, three calls', async () => {
    let n = 0
    f = makeKindFixture({
      toPng: (b) => {
        n += 1
        if (n === 2) throw new Error('The picture could not be turned into a PNG')
        return b
      },
    })
    const id = await f.start({ count: 3 })
    await waitFor(done(id))
    const row = f.job(id)
    expect(row).toMatchObject({ status: 'succeeded', paidCalls: 3 })
    expect(row?.result).toMatchObject({ failures: { other: 1 } })
    expect((row?.result as { assetIds: string[] }).assetIds).toHaveLength(2)
    expect(f.files()).toHaveLength(2)
    expect(f.assets()).toHaveLength(2)
  })

  for (const [name, answer] of [
    ['a PNG answer', pngAnswer(3)],
    ['a JPEG answer', jpegAnswer()],
  ] as const) {
    it(`stores the stand-in's PNG, not the provider's bytes, for ${name}`, async () => {
      const converted = greyPng(7, 6)
      f = makeKindFixture({ toPng: () => converted })
      f.t.answers = [answer]
      const id = await f.start({ count: 1 })
      await waitFor(done(id))
      expect(f.toPngCalls).toEqual([answer.bytes])
      const [assetId] = (f.job(id)?.result as { assetIds: string[] }).assetIds
      const stored = fileOf(assetId ?? '')
      expect(withoutText(stored)).toEqual(withoutText(converted))
      expect(pictureSize(stored, 'image/png')).toEqual({ width: 7, height: 6 })
      expect(f.assets()[0]).toMatchObject({ width: 7, height: 6, mime: 'image/png' })
    })
  }
})

describe('the image_generation job kind with reference pictures [SPEC 14 1.46 RF-0]', () => {
  it('hands two reference pictures in the order of the IDs, with the bytes of each file (item 1)', async () => {
    f = makeKindFixture()
    const importOne = async (name: string, bytes: Uint8Array) => {
      fs.writeFileSync(path.join(f.root, name), bytes)
      const r = await f.user('asset.import', {
        paths: [path.join(f.root, name)],
        library: 'reference',
        copy: false,
      })
      return (r as { data: { assetIds: string[] } }).data.assetIds[0]
    }
    const wide = greyPng(6, 2)
    const tall = greyPng(2, 6)
    const wideId = await importOne('wide.png', wide)
    const tallId = await importOne('tall.png', tall)
    const id = await f.start({ count: 2, referenceAssetIds: [tallId, wideId] })
    await waitFor(done(id))
    expect(f.calls).toHaveLength(2)
    for (const call of f.calls) {
      expect(call.input.references).toEqual([
        { bytes: new Uint8Array(tall), mime: 'image/png' },
        { bytes: new Uint8Array(wide), mime: 'image/png' },
      ])
    }
  })
})
