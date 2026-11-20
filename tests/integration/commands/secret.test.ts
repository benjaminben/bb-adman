import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { makeFixture, fakeCrypto, data, type Fixture } from '../core-fixture'
import type { AppState } from '../../../src/shared/schemas/queries/app'

let f: Fixture
afterEach(() => f.cleanup())

const KEY = 'AIzaSyD-secret-key-value-9xQ7'
const state = async () => data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))

function filesUnder(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.join(d.parentPath, d.name))
}

describe('secret.set [FR-170, FR-172, FR-173, R-10]', () => {
  it('saves a key and app.getState shows only its last four characters', async () => {
    f = makeFixture()
    expect((await f.user('secret.set', { name: 'gemini.apiKey', value: KEY })).ok).toBe(true)
    const s = await state()
    expect(s.secrets).toEqual([{ name: 'gemini.apiKey', lastFour: '9xQ7' }])
    expect(JSON.stringify(s)).not.toContain(KEY)
  })

  it('keeps the key after a restart', async () => {
    f = makeFixture()
    await f.user('secret.set', { name: 'fal.apiKey', value: KEY })
    f.restart()
    expect((await state()).secrets).toEqual([{ name: 'fal.apiKey', lastFour: '9xQ7' }])
    expect(f.core.secrets.get('fal.apiKey')).toBe(KEY)
  })

  it('stores keys encrypted in secrets.bin and nowhere else in the app data folder, logs included', async () => {
    f = makeFixture()
    await f.user('secret.set', { name: 'gemini.apiKey', value: KEY })
    await f.user('project.create', { name: 'A', location: f.projectsDir })
    const files = [...filesUnder(f.userData), ...filesUnder(f.projectsDir)]
    expect(files.map((p) => path.basename(p))).toContain('secrets.bin')
    for (const file of files) expect(fs.readFileSync(file).toString('latin1')).not.toContain(KEY)
  })

  it('replaces a saved key', async () => {
    f = makeFixture()
    await f.user('secret.set', { name: 'gemini.apiKey', value: KEY })
    await f.user('secret.set', { name: 'gemini.apiKey', value: 'another-key-abcd' })
    expect((await state()).secrets).toEqual([{ name: 'gemini.apiKey', lastFour: 'abcd' }])
  })

  it('does not show any characters of a key of four characters or fewer', async () => {
    f = makeFixture()
    await f.user('secret.set', { name: 'gemini.apiKey', value: 'abcd' })
    expect((await state()).secrets).toEqual([{ name: 'gemini.apiKey', lastFour: '' }])
  })

  it('refuses to save when the computer cannot store keys securely', async () => {
    f = makeFixture({ crypto: fakeCrypto(false) })
    const result = await f.user('secret.set', { name: 'gemini.apiKey', value: KEY })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'This computer cannot store keys securely.' },
    })
    expect(fs.existsSync(path.join(f.userData, 'secrets.bin'))).toBe(false)
  })

  it.each([
    [{ name: 'unknown.key', value: KEY }],
    [{ name: 'mcp.token', value: KEY }],
    [{ name: 'gemini.apiKey', value: '' }],
    [{ name: 'gemini.apiKey', value: '   ' }],
  ])('rejects %j with INVALID_INPUT', async (input) => {
    f = makeFixture()
    expect(await f.user('secret.set', input)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('is denied to agents [FR-198]', async () => {
    f = makeFixture()
    expect(await f.agent('secret.set', { name: 'gemini.apiKey', value: KEY })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect((await state()).secrets).toEqual([])
  })
})

describe('secret.delete [R-10]', () => {
  it('deletes a saved key', async () => {
    f = makeFixture()
    await f.user('secret.set', { name: 'gemini.apiKey', value: KEY })
    await f.user('secret.set', { name: 's3.accessKeyId', value: 'AKIA-example-1234' })
    expect((await f.user('secret.delete', { name: 'gemini.apiKey' })).ok).toBe(true)
    expect((await state()).secrets).toEqual([{ name: 's3.accessKeyId', lastFour: '1234' }])
    expect(f.core.secrets.get('gemini.apiKey')).toBeUndefined()
  })

  it('returns NOT_FOUND for a key that is not saved', async () => {
    f = makeFixture()
    expect(await f.user('secret.delete', { name: 'gemini.apiKey' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })

  it('is denied to agents', async () => {
    f = makeFixture()
    await f.user('secret.set', { name: 'gemini.apiKey', value: KEY })
    expect(await f.agent('secret.delete', { name: 'gemini.apiKey' })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
  })
})

describe('app.getState and the MCP access token [SPEC 4.3, 7.7, D-014]', () => {
  it('lists mcp.token by its last four characters only, like every other secret', async () => {
    f = makeFixture()
    const token = 'mcp-token-value-abcdefghijklmn-Zz9Q'
    f.core.secrets.set('mcp.token', token)
    await f.user('secret.set', { name: 'gemini.apiKey', value: KEY })
    const s = await state()
    expect(s.secrets).toEqual([
      { name: 'gemini.apiKey', lastFour: '9xQ7' },
      { name: 'mcp.token', lastFour: 'Zz9Q' },
    ])
    expect(JSON.stringify(s)).not.toContain(token)
  })
})
