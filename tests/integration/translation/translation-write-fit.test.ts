// MV-5 (spec/make-variants.md, "When a translation arrives", "What a fitted size is to the
// link"): when translation.write fills a text layer whose status was `missing`, on a variant
// that is not the master, the font size is fitted to the new words, only ever smaller. The
// style, its counter and the override path are written with the words. Nothing else fits.
import { describe, it, expect, afterEach } from 'vitest'
import { setFakeBehaviour } from '@/main/providers/fake/behaviour'
import { fittedFontSize } from '@/shared/links/fit-text'
import type { TextStyle } from '@/shared/schemas/layer'
import { data } from '../core-fixture'
import { makeProposeFixture, waitFor, type ProposeFixture } from './propose-fixture'

let f: ProposeFixture
afterEach(() => f.cleanup())

const LONG = 'Ein sehr langer Satz über den ganzen Sommer und noch viel mehr '.repeat(12).trim()
const SHORT = 'Hi'

const write = (jobId: string, items: Array<{ key: string; text: string }>) =>
  f.user('translation.write', { jobId, items })

// A translation job for D1 held running by the fake.
async function runningJob(): Promise<string> {
  f = await makeProposeFixture()
  setFakeBehaviour({ waitMs: 2_000 })
  const r = await f.user('translation.propose', { provider: 'fake', variantIds: ['D1'] })
  const [jobId = ''] = data<{ jobIds: string[] }>(r).jobIds
  await waitFor(() => f.job(jobId)?.status === 'running')
  return jobId
}

async function stop(jobId: string) {
  await f.user('job.cancel', { jobId })
  await waitFor(() => f.ended(jobId))
}

// The key of the master's headline, or the first text key when no layer has that slot.
function headlineKey(): string {
  const key = f.textKeys.find((k) => f.layer(f.masterLayerId(k)).slot === 'headline')
  return key ?? f.textKeys[0] ?? ''
}

// The size the estimate gives the words on D1's layer, from its size now.
function estimate(layerId: string, text: string): number {
  const layer = f.layer(layerId)
  const variant = f.db.prepare("SELECT width, height FROM variant WHERE id = 'D1'").get() as {
    width: number
    height: number
  }
  return fittedFontSize(text, layer.geometry, layer.style as TextStyle, variant)
}

const variantRev = (id: string) =>
  (f.db.prepare('SELECT rev FROM variant WHERE id = ?').get(id) as { rev: number }).rev

describe('translation.write fits a missing translation [MV-5]', () => {
  it('shrinks a missing headline filled with long words to the estimate and adds style.fontSize', async () => {
    const jobId = await runningJob()
    const key = headlineKey()
    const layerId = f.id('D1', key)
    const before = f.layer(layerId)
    const expected = estimate(layerId, LONG)
    expect(expected).toBeLessThan((before.style as TextStyle).fontSize)
    expect(await write(jobId, [{ key, text: LONG }])).toEqual({ ok: true, data: { written: 1 } })
    const after = f.layer(layerId)
    expect(after.copy).toBe(LONG)
    expect((after.style as TextStyle).fontSize).toBe(expected)
    expect(after.style).toEqual({ ...before.style, fontSize: expected })
    expect(after.revs.style).toBe(before.revs.style + 1)
    expect(after.overrides).toEqual([...before.overrides, 'style.fontSize'])
    expect(after.syncedRevs.style).toBe(before.syncedRevs.style)
    await stop(jobId)
  })

  it('leaves style, its counter and the overrides as they were for short words', async () => {
    const jobId = await runningJob()
    const key = headlineKey()
    const layerId = f.id('D1', key)
    const before = f.layer(layerId)
    expect(await write(jobId, [{ key, text: SHORT }])).toEqual({ ok: true, data: { written: 1 } })
    const after = f.layer(layerId)
    expect(after.copy).toBe(SHORT)
    expect(after.style).toEqual(before.style)
    expect(after.revs.style).toBe(before.revs.style)
    expect(after.overrides).toEqual(before.overrides)
    await stop(jobId)
  })

  it('does not fit a proposed layer written again', async () => {
    const jobId = await runningJob()
    const key = headlineKey()
    const layerId = f.id('D1', key)
    f.setRow(layerId, { translation_status: 'proposed', translation_source: 'ai', copy: 'Alt' })
    const before = f.layer(layerId)
    expect(await write(jobId, [{ key, text: LONG }])).toEqual({ ok: true, data: { written: 1 } })
    const after = f.layer(layerId)
    expect(after.copy).toBe(LONG)
    expect(after.style).toEqual(before.style)
    expect(after.revs.style).toBe(before.revs.style)
    expect(after.overrides).toEqual(before.overrides)
    await stop(jobId)
  })

  it('shrinks an unlinked layer and adds no override path', async () => {
    const jobId = await runningJob()
    const key = headlineKey()
    const layerId = f.id('D1', key)
    f.setRow(layerId, { linked: 0 })
    const before = f.layer(layerId)
    const expected = estimate(layerId, LONG)
    expect(await write(jobId, [{ key, text: LONG }])).toEqual({ ok: true, data: { written: 1 } })
    const after = f.layer(layerId)
    expect((after.style as TextStyle).fontSize).toBe(expected)
    expect(after.revs.style).toBe(before.revs.style + 1)
    expect(after.overrides).toEqual([])
    await stop(jobId)
  })

  it('keeps the written count and bumps variant.rev once when every layer is fitted', async () => {
    const jobId = await runningJob()
    const items = f.textKeys.map((key) => ({ key, text: LONG }))
    const rev = variantRev('D1')
    const fitted = f.textKeys.filter((k) => estimate(f.id('D1', k), LONG) < sizeOf('D1', k))
    expect(fitted.length).toBeGreaterThan(0)
    expect(await write(jobId, items)).toEqual({
      ok: true,
      data: { written: f.textKeys.length },
    })
    expect(variantRev('D1')).toBe(rev + 1)
    for (const key of fitted) expect(f.layer(f.id('D1', key)).overrides).toContain('style.fontSize')
    await stop(jobId)
  })
})

function sizeOf(variantId: string, key: string): number {
  return (f.layer(f.id(variantId, key)).style as TextStyle).fontSize
}

describe('translation.set fits nothing [MV-5]', () => {
  it.each(['user', 'agent'] as const)(
    'leaves the style of a missing layer set by the %s',
    async (actor) => {
      f = await makeProposeFixture()
      const layerId = f.id('D1', headlineKey())
      const before = f.layer(layerId)
      const input = { layerId, text: LONG, applyToSameLanguage: false }
      expect(await f[actor]('translation.set', input)).toMatchObject({ ok: true })
      const after = f.layer(layerId)
      expect(after.copy).toBe(LONG)
      expect(after.style).toEqual(before.style)
      expect(after.revs.style).toBe(before.revs.style)
      expect(after.overrides).toEqual(before.overrides)
    },
  )
})
