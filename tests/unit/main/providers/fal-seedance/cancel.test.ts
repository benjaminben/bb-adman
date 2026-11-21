import { describe, expect, it } from 'vitest'
import { falVideo } from '@/main/providers/fal-seedance/video'
import { APP, QUEUE, REQUEST_ID, TEST_KEY, json, only, standIn, testContext } from './stand-in'

describe('fal Seedance cancel [P7-14, phase-07 "Cancel"]', () => {
  it.each([
    {
      name: '200',
      answer: () => json({ status: 'CANCELLATION_REQUESTED' }, 200),
      outcome: 'stopped',
    },
    {
      name: '400 ALREADY_COMPLETED',
      answer: () => json({ status: 'ALREADY_COMPLETED' }, 400),
      outcome: 'finished',
    },
    {
      name: '202',
      answer: () => json({ status: 'CANCELLATION_REQUESTED' }, 202),
      outcome: 'unknown',
    },
    {
      name: '400 other',
      answer: () => json({ status: 'SOMETHING_ELSE' }, 400),
      outcome: 'unknown',
    },
    {
      name: '400 not JSON',
      answer: () => new Response('nope', { status: 400 }),
      outcome: 'unknown',
    },
    { name: '404', answer: () => json({ detail: 'Not found' }, 404), outcome: 'unknown' },
    { name: '500', answer: () => json({}, 500), outcome: 'unknown' },
    {
      name: 'a redirect',
      answer: () => new Response(null, { status: 302, headers: { location: 'https://x.example' } }),
      outcome: 'unknown',
    },
    {
      name: 'a network error',
      answer: () => {
        throw new TypeError('fetch failed')
      },
      outcome: 'unknown',
    },
  ])('an answer of $name is $outcome', async ({ answer, outcome }) => {
    const { fetchFn, seen } = standIn(answer)
    expect(await falVideo(testContext(), { fetch: fetchFn }).cancel(REQUEST_ID)).toBe(outcome)
    const request = only(seen)
    expect(request.method).toBe('PUT')
    expect(request.url).toBe(`${QUEUE}/${APP}/requests/${REQUEST_ID}/cancel`)
    expect(request.headers.get('authorization')).toBe(`Key ${TEST_KEY}`)
  })
})
