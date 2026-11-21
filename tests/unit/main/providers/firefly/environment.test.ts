import { afterEach, describe, it, expect } from 'vitest'
import { fireflyImage } from '@/main/providers/firefly/image'
import {
  FIREFLY_API_ORIGIN,
  FIREFLY_PICTURE_ORIGIN,
  FIREFLY_TOKEN_ORIGIN,
} from '@/main/providers/firefly/pinned-origin'
import {
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TEST_TOKEN,
  fireflyAnswering,
  noWait,
  testContext,
} from './recorded'

const savedEnv = { ...process.env }
afterEach(() => {
  process.env = { ...savedEnv }
})

const input = { prompt: 'A red bicycle', references: [], width: 1080, height: 1080, count: 1 }

describe('Firefly takes nothing from the environment [P4-6, spec/providers.md]', () => {
  it('goes to the pinned hosts with the credentials the adapter was given', async () => {
    // The names Adobe's public examples read credentials from, and the proxy and address
    // variables a client might read.
    Object.assign(process.env, {
      FIREFLY_SERVICES_CLIENT_ID: 'environment-client-id-must-not-be-used',
      FIREFLY_SERVICES_CLIENT_SECRET: 'environment-client-secret-must-not-be-used',
      FIREFLY_SERVICES_ACCESS_TOKEN: 'environment-token-must-not-be-used',
      FIREFLY_API_URL: 'https://firefly-environment.example',
      IMS_URL: 'https://ims-environment.example',
      HTTPS_PROXY: 'https://proxy-environment.example',
      HTTP_PROXY: 'http://proxy-environment.example',
    })
    const { fetchFn, seen } = fireflyAnswering()
    const results = await fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate(
      input,
    )
    expect(results).toHaveLength(1)
    expect(seen.map((r) => new URL(r.url).origin)).toEqual([
      FIREFLY_TOKEN_ORIGIN,
      FIREFLY_API_ORIGIN,
      FIREFLY_API_ORIGIN,
      FIREFLY_PICTURE_ORIGIN,
    ])
    const [token, submit] = seen
    const form = new URLSearchParams(token?.body)
    expect(form.get('client_id')).toBe(TEST_CLIENT_ID)
    expect(form.get('client_secret')).toBe(TEST_CLIENT_SECRET)
    expect(submit?.headers.get('x-api-key')).toBe(TEST_CLIENT_ID)
    expect(submit?.headers.get('authorization')).toBe(`Bearer ${TEST_TOKEN}`)
  })
})
