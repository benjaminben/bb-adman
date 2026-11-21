import { describe, expect, it } from 'vitest'
import { falVideo } from '@/main/providers/fal-seedance/video'
import { REQUEST_ID, json, standIn, testContext } from './stand-in'

const BAD_IDS = [
  '',
  '../../../other-app/requests/x',
  `${REQUEST_ID}/../x`,
  `${REQUEST_ID}?x=1`,
  'c0ffee00-0000-4000-8000-00000000000',
  'c0ffee00_0000_4000_8000_000000000001',
  `https://files.example/${REQUEST_ID}`,
]

describe('fal Seedance request IDs [P7-14, phase-07 "A request ID must match the UUID form"]', () => {
  it.each(BAD_IDS)('check refuses %j before any request', async (id) => {
    const { fetchFn, seen } = standIn(() => json({ status: 'COMPLETED' }))
    const checked = await falVideo(testContext(), { fetch: fetchFn }).check(id)
    expect(checked.status).toBe('failed')
    expect(checked.error?.detail).not.toContain(id || 'no-id')
    expect(seen).toHaveLength(0)
  })

  it.each(BAD_IDS)('fetchResult refuses %j before any request', async (id) => {
    const { fetchFn, seen } = standIn(() => json({}))
    const run = falVideo(testContext(), { fetch: fetchFn }).fetchResult(id)
    await expect(run).rejects.toMatchObject({ error: { kind: 'other' } })
    expect(seen).toHaveLength(0)
  })

  it.each(BAD_IDS)('cancel gives unknown for %j before any request', async (id) => {
    const { fetchFn, seen } = standIn(() => json({}, 200))
    expect(await falVideo(testContext(), { fetch: fetchFn }).cancel(id)).toBe('unknown')
    expect(seen).toHaveLength(0)
  })
})
