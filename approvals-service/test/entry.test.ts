import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrate, MIGRATIONS } from '../scripts/migrate'
import * as route from '../app/[[...path]]/route'
import { loadEnv } from '../src/server/env'
import { serve } from '../src/server/serve'

// spec/approvals-service.md "How Next.js and the service code fit" and "Environment": one
// request through the catch-all's own exports proves it wires the same app.

const ORIGIN = 'https://approvals.example'
const KEY = process.env.API_KEY ?? ''
const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${path}`, { headers })

// The entry opens its own database from the address, so the tests give it a migrated file.
const folder = mkdtempSync(join(tmpdir(), 'adman-entry-'))
const DATABASE = `file:${join(folder, 'entry.db')}`
const setup = createClient({ url: DATABASE })
await migrate(setup, MIGRATIONS)
setup.close()
afterAll(() => rmSync(folder, { recursive: true, force: true }))

beforeEach(() => {
  vi.stubEnv('TURSO_DATABASE_URL', DATABASE)
  vi.stubEnv('VERCEL', undefined)
  vi.stubEnv('TEST_PICTURE_ORIGIN', undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the catch-all route [AP-14]', () => {
  it('exports serve for every method, and asks for a fresh reply each time', () => {
    for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const) {
      expect(route[method]).toBe(serve)
    }
    expect(route.dynamic).toBe('force-dynamic')
    expect(route.runtime).toBe('nodejs')
  })

  it('answers health with the key from its environment', async () => {
    const reply = await route.GET(get('/api/v1/health', { Authorization: `Bearer ${KEY}` }))
    expect(reply.status).toBe(200)
    expect(await reply.json()).toEqual({ service: 'adman-approvals', contract: 1 })
  })

  it('answers robots.txt and a slug of the right shape with their pages', async () => {
    const robots = await route.GET(get('/robots.txt'))
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n')
    const page = await route.GET(get('/l/aZ09aZ09aZ09'))
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('<h1>Review campaign</h1>')
  })

  it.each(['/nothing', '/l/short'])('answers %s with the plain 404 page', async (path) => {
    const reply = await route.GET(get(path))
    expect(reply.status).toBe(404)
    expect(reply.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(await reply.text()).toBe('Not found.')
  })
})

describe('loadEnv [AP-14 "Environment"]', () => {
  it.each([
    ['1', undefined],
    ['', undefined],
    [undefined, 'http://127.0.0.1:4100'],
  ])('with VERCEL=%j gives TEST_PICTURE_ORIGIN %j', (vercel, expected) => {
    vi.stubEnv('VERCEL', vercel)
    vi.stubEnv('TEST_PICTURE_ORIGIN', 'http://127.0.0.1:4100')
    expect(loadEnv().TEST_PICTURE_ORIGIN).toBe(expected)
  })

  it('keeps one database for one address', () => {
    expect(loadEnv().DB).toBe(loadEnv().DB)
  })

  it.each([undefined, '', 'not an address'])(
    'with database address %j the API is not set up',
    async (url) => {
      vi.stubEnv('TURSO_DATABASE_URL', url)
      expect(loadEnv().API_KEY).toBeUndefined()
      const reply = await serve(get('/api/v1/health', { Authorization: `Bearer ${KEY}` }))
      expect(reply.status).toBe(503)
      expect(((await reply.json()) as { error: { code: string } }).error.code).toBe('not_set_up')
    },
  )

  it('with no database address a visitor route gives the fixed 500 and logs no value', async () => {
    vi.stubEnv('TURSO_DATABASE_URL', undefined)
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cookie = `__Host-adman-aZ09aZ09aZ09=${'a'.repeat(43)}`
    const reply = await serve(get('/l/aZ09aZ09aZ09', { Cookie: cookie }))
    expect(reply.status).toBe(500)
    expect(await reply.text()).toBe('Something went wrong. Try again later.')
    expect(JSON.stringify(logged.mock.calls)).not.toContain(KEY)
    logged.mockRestore()
  })
})
