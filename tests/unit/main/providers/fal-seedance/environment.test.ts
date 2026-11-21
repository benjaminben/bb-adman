import { afterEach, describe, expect, it } from 'vitest'
import { falVideo } from '@/main/providers/fal-seedance/video'
import {
  APP,
  MEDIA_URL,
  QUEUE,
  REQUEST_ID,
  TEST_KEY,
  standIn,
  testContext,
  wholeRun,
} from './stand-in'

const savedEnv = { ...process.env }
afterEach(() => {
  process.env = { ...savedEnv }
})

// The fal client's own variables and the proxy variables, all set to other values.
const ENVIRONMENT = {
  FAL_KEY: 'environment-fal-key-must-not-be-used',
  FAL_KEY_ID: 'environment-fal-key-id',
  FAL_KEY_SECRET: 'environment-fal-key-secret',
  FAL_QUEUE_URL: 'https://queue-environment.example',
  HTTP_PROXY: 'http://proxy-environment.example:8080',
  HTTPS_PROXY: 'http://proxy-environment.example:8080',
  ALL_PROXY: 'http://proxy-environment.example:8080',
  NO_PROXY: '*',
  http_proxy: 'http://proxy-environment.example:8080',
  https_proxy: 'http://proxy-environment.example:8080',
}

describe('fal Seedance takes nothing from the environment [P7-14]', () => {
  it('sends a whole run to the fixed addresses with the given key', async () => {
    Object.assign(process.env, ENVIRONMENT)
    const { fetchFn, seen } = standIn(wholeRun())
    const video = falVideo(testContext(), { fetch: fetchFn })
    const input = { prompt: 'A kite', durationMs: 4_000, width: 1080, height: 1080 }
    await video.start({ ...input, image: null, references: [] })
    await video.check(REQUEST_ID)
    await video.fetchResult(REQUEST_ID)
    await video.cancel(REQUEST_ID)
    expect(seen.map((s) => s.url)).toEqual([
      `${QUEUE}/${APP}/text-to-video`,
      `${QUEUE}/${APP}/requests/${REQUEST_ID}/status`,
      `${QUEUE}/${APP}/requests/${REQUEST_ID}`,
      MEDIA_URL,
      `${QUEUE}/${APP}/requests/${REQUEST_ID}/cancel`,
    ])
    for (const s of seen) {
      const expected = s.url === MEDIA_URL ? null : `Key ${TEST_KEY}`
      expect(s.headers.get('authorization')).toBe(expected)
      expect(s.redirect).toBe('manual')
    }
  })
})
