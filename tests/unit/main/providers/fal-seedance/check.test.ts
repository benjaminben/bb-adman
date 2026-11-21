import { describe, expect, it } from 'vitest'
import { FAL_RUN_MS, falVideo } from '@/main/providers/fal-seedance/video'
import { APP, QUEUE, REQUEST_ID, TEST_KEY, json, only, standIn, testContext } from './stand-in'

const policy = { status: 'COMPLETED', error: 'Not allowed', error_type: 'content_policy_violation' }

describe('fal Seedance check [P7-14, phase-07 "Status mapping"]', () => {
  it.each([
    {
      answer: json({ status: 'IN_QUEUE', queue_position: 3, response_url: 'https://x.example' }),
      state: { status: 'waiting', queuePosition: 3 },
    },
    { answer: json({ status: 'IN_PROGRESS', logs: [] }), state: { status: 'running' } },
    { answer: json({ status: 'COMPLETED', logs: [] }), state: { status: 'succeeded' } },
    {
      answer: json(policy),
      state: { status: 'failed', error: { kind: 'refused', detail: expect.any(String) } },
    },
    {
      answer: json({ status: 'COMPLETED', error: 'Some trouble', error_type: 'Weird Type!' }),
      state: { status: 'failed', error: { kind: 'other', detail: 'The run failed' } },
    },
    {
      answer: json({ detail: 'Request not found' }, 404),
      state: { status: 'failed', error: { kind: 'other', detail: 'unknown_request' } },
    },
    {
      answer: json({ detail: 'No key' }, 401),
      state: { status: 'failed', error: { kind: 'bad_key', detail: 'HTTP 401' } },
    },
    {
      answer: json({ status: 'SOMETHING_NEW' }),
      state: { status: 'failed', error: { kind: 'other', detail: expect.any(String) } },
    },
  ])('maps $answer.status / $state.status', async ({ answer, state }) => {
    const { fetchFn, seen } = standIn(() => answer)
    const checked = await falVideo(testContext(), { fetch: fetchFn }).check(REQUEST_ID)
    expect(checked).toEqual(state)
    const request = only(seen)
    expect(request.method).toBe('GET')
    expect(request.url).toBe(`${QUEUE}/${APP}/requests/${REQUEST_ID}/status`)
    expect(request.headers.get('authorization')).toBe(`Key ${TEST_KEY}`)
  })

  it('a refused run keeps no text from the answer', async () => {
    const { fetchFn } = standIn(() => json(policy))
    const checked = await falVideo(testContext(), { fetch: fetchFn }).check(REQUEST_ID)
    expect(checked.error?.detail).not.toContain('Not allowed')
  })

  it('a status call that cannot reach fal keeps the last state, until the run limit', async () => {
    let clock = 0
    let reachable = true
    const { fetchFn } = standIn(() => {
      if (!reachable) throw new TypeError('fetch failed')
      return json({ status: 'IN_QUEUE', queue_position: 1 })
    })
    const video = falVideo(testContext(), { fetch: fetchFn, now: () => clock })
    expect(await video.check(REQUEST_ID)).toEqual({ status: 'waiting', queuePosition: 1 })
    reachable = false
    expect(await video.check(REQUEST_ID)).toEqual({ status: 'waiting', queuePosition: 1 })
    clock = FAL_RUN_MS + 1
    expect(await video.check(REQUEST_ID)).toEqual({
      status: 'failed',
      error: { kind: 'timeout', detail: expect.any(String) },
    })
  })

  it('a run not done 15 minutes after it was first seen fails as a timeout', async () => {
    let clock = 0
    const { fetchFn } = standIn(() => json({ status: 'IN_PROGRESS' }))
    const video = falVideo(testContext(), { fetch: fetchFn, now: () => clock })
    expect(FAL_RUN_MS).toBe(15 * 60_000)
    expect(await video.check(REQUEST_ID)).toEqual({ status: 'running' })
    clock = FAL_RUN_MS + 1
    expect((await video.check(REQUEST_ID)).error?.kind).toBe('timeout')
  })
})
