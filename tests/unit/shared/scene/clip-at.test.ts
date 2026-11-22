// P7-8, phase-07.md "Clips and the track": the clip under a time and its source time
// inMs + t - startMs; nothing in a gap or past the variant's end. Stored numbers may come from
// someone else's project file, so they are rounded and clamped before use.
import { describe, expect, it } from 'vitest'
import { clipAt, safePlacement } from '@/shared/scene/clip-at'
import type { SceneClip } from '@/shared/scene/types'
import { MAX_TRACK_MS } from '@/shared/schemas/commands/clip'

const clip = (id: string, startMs: number, inMs: number, outMs: number): SceneClip => ({
  id,
  assetId: `asset-${id}`,
  startMs,
  inMs,
  outMs,
  placement: null,
  soundOn: true,
})

// a: 0..1000 from source 500; b: 2000..3000 from source 0; c: 3000..4500 from source 100.
const TRACK = [clip('b', 2000, 0, 1000), clip('a', 0, 500, 1500), clip('c', 3000, 100, 1600)]

describe('clipAt', () => {
  it.each([
    ['the first clip at its start', 0, 'a', 500],
    ['inside the first clip', 400, 'a', 900],
    ['the last millisecond of the first clip', 999, 'a', 1499],
    ['a gap after the first clip', 1000, null, null],
    ['a gap just before the second clip', 1999, null, null],
    ['the second clip at its start', 2000, 'b', 0],
    ['where one clip ends and the next starts', 3000, 'c', 100],
    ['the last clip near its end', 4499, 'c', 1599],
    ['past the last clip', 4500, null, null],
    ['a time with a fraction, rounded', 400.6, 'a', 901],
    ['a negative time, read as 0', -50, 'a', 500],
    ['a time that is not a number', Number.NaN, 'a', 500],
  ])('%s', (_name, t, id, sourceMs) => {
    const found = clipAt(TRACK, t, 10_000)
    expect(found?.clip.id ?? null).toBe(id)
    expect(found?.sourceMs ?? null).toBe(sourceMs)
  })

  it.each([
    ['at the variant end', 4000, 4000, null],
    ['past the variant end', 5000, 4000, null],
    ['just before the variant end', 3999, 4000, 'c'],
    ['a variant of no length', 0, 0, null],
  ])('a clip that runs past the variant end: %s', (_name, t, durationMs, id) => {
    expect(clipAt(TRACK, t, durationMs)?.clip.id ?? null).toBe(id)
  })

  it('gives nothing on an empty track', () => {
    expect(clipAt([], 0, 4000)).toBeNull()
  })

  it('takes the earliest start, then the lower ID, when stored clips overlap', () => {
    const track = [clip('z', 0, 0, 2000), clip('y', 500, 0, 2000), clip('x', 0, 0, 1000)]
    expect(clipAt(track, 600, 4000)?.clip.id).toBe('x')
    expect(clipAt(track, 1200, 4000)?.clip.id).toBe('z')
  })

  it.each([
    ['a trim with no length', clip('d', 0, 500, 500)],
    ['an out before the in', clip('d', 0, 900, 100)],
    ['a start that is not a number', clip('d', Number.NaN, 0, 1000)],
    ['an in that is infinite', clip('d', 0, Number.POSITIVE_INFINITY, 1000)],
  ])('skips a stored clip with %s', (_name, bad) => {
    expect(clipAt([bad], 0, 4000)).toBeNull()
  })

  it('rounds and clamps stored times', () => {
    const odd = clip('d', -20.4, -3, 999.6)
    const found = clipAt([odd], 10, 4000)
    expect(found?.clip).toMatchObject({ startMs: 0, inMs: 0, outMs: 1000 })
    expect(found?.sourceMs).toBe(10)
    const far = clipAt([clip('e', 0, 0, MAX_TRACK_MS * 10)], 5, 4000)
    expect(far?.clip.outMs).toBe(MAX_TRACK_MS)
  })
})

describe('safePlacement', () => {
  const geometry = { x: 10, y: 20, width: 300, height: 200, rotation: 0, crop: null }

  it('keeps a sound placement', () => {
    expect(safePlacement(geometry)).toEqual(geometry)
  })

  it.each([
    ['fractions, rounded', { ...geometry, x: 10.4, width: 299.6 }, { x: 10, width: 300 }],
    ['a size below one pixel', { ...geometry, width: 0, height: -5 }, { width: 1, height: 1 }],
    ['a huge size', { ...geometry, width: 1e12 }, { width: 8192 * 4 }],
    ['a huge offset', { ...geometry, x: -1e12, y: 1e12 }, { x: -8192 * 4, y: 8192 * 4 }],
    ['a rotation that is not a number', { ...geometry, rotation: Number.NaN }, { rotation: 0 }],
    ['a big rotation', { ...geometry, rotation: 725 }, { rotation: 5 }],
    ['an x that is not a number', { ...geometry, x: Number.NaN }, { x: 0 }],
  ])('clamps %s', (_name, input, expected) => {
    expect(safePlacement(input)).toMatchObject(expected)
  })

  it('clamps a crop the same way', () => {
    const crop = { x: 1.5, y: -2.2, width: 0, height: 40.7 }
    expect(safePlacement({ ...geometry, crop }).crop).toEqual({
      x: 2,
      y: -2,
      width: 1,
      height: 41,
    })
  })
})
