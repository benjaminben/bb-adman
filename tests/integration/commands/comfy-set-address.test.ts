import { describe, it, expect, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '../../../src/shared/schemas/queries/app'

let f: Fixture
afterEach(() => {
  vi.restoreAllMocks()
  f.cleanup()
})

const state = async () => data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
const set = (address: unknown) => f.user('comfy.setAddress', { address })
const settingsFile = () => path.join(f.userData, 'settings.json')
const fileText = () =>
  fs.existsSync(settingsFile()) ? fs.readFileSync(settingsFile(), 'utf8') : ''

describe('comfy.setAddress [SPEC 4.2, 6.10.1; FR-250, FR-251, FR-253]', () => {
  it('saves the origin of an accepted address and tells the window', async () => {
    f = makeFixture()
    expect(await set(' 192.168.1.20:8188/ ')).toEqual({
      ok: true,
      data: { baseUrl: 'http://192.168.1.20:8188' },
    })
    expect((await state()).settings.comfyui).toEqual({ baseUrl: 'http://192.168.1.20:8188' })
    expect(JSON.parse(fileText()).comfyui).toEqual({ baseUrl: 'http://192.168.1.20:8188' })
    expect(f.events).toContainEqual({ name: 'app.stateChanged', payload: {} })
  })

  it('keeps the address after a restart', async () => {
    f = makeFixture()
    await set('http://my-pc.local:8188')
    f.restart()
    expect((await state()).settings.comfyui).toEqual({ baseUrl: 'http://my-pc.local:8188' })
  })

  it('removes the address with null', async () => {
    f = makeFixture()
    await set('http://192.168.1.20:8188')
    expect(await set(null)).toEqual({ ok: true, data: { baseUrl: null } })
    expect((await state()).settings.comfyui).toEqual({ baseUrl: null })
    expect(JSON.parse(fileText()).comfyui).toEqual({ baseUrl: null })
  })

  it.each([
    ['   ', 'address_empty'],
    ['x'.repeat(256), 'address_unreadable'],
    ['ftp://192.168.1.20:8188', 'address_scheme'],
    ['http://user:pw@192.168.1.20:8188', 'address_credentials'],
    ['http://192.168.1.20:8188/comfy', 'address_extra'],
    ['http://169.254.169.254', 'address_host_refused'],
  ])('refuses %j with INVALID_INPUT and reason %s, and writes nothing', async (text, reason) => {
    f = makeFixture()
    await set('http://192.168.1.20:8188')
    const before = fileText()
    const eventsBefore = f.events.length
    const result = await set(text)
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', details: { reason } },
    })
    const message = (result as { error: { message: string } }).error.message
    expect(message.length).toBeGreaterThan(0)
    if (text.trim() !== '') expect(message).not.toContain(text.trim())
    expect(fileText()).toBe(before)
    expect((await state()).settings.comfyui).toEqual({ baseUrl: 'http://192.168.1.20:8188' })
    expect(f.events.slice(eventsBefore)).not.toContainEqual({
      name: 'app.stateChanged',
      payload: {},
    })
  })

  it('refuses an input that is not text or null', async () => {
    f = makeFixture()
    expect(await set(8188)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(await f.user('comfy.setAddress', {})).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect((await state()).settings.comfyui).toEqual({ baseUrl: null })
  })

  it('checks loopback against the MCP port as it is now and the Dropbox sign-in port', async () => {
    f = makeFixture()
    const refused = { ok: false, error: { details: { reason: 'address_host_refused' } } }
    expect(await set('http://127.0.0.1:47821')).toMatchObject(refused)
    expect(await set('http://127.0.0.1:47822')).toMatchObject(refused)
    await f.user('settings.update', { mcp: { port: 50000 } })
    expect(await set('http://127.0.0.1:50000')).toMatchObject(refused)
    expect(await set('http://127.0.0.1:47821')).toMatchObject({ ok: true })
  })

  it('is refused to an agent and changes nothing', async () => {
    f = makeFixture()
    expect(
      await f.agent('comfy.setAddress', { address: 'http://192.168.1.20:8188' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect((await state()).settings.comfyui).toEqual({ baseUrl: null })
  })

  it('contacts nothing', async () => {
    f = makeFixture()
    const connect = vi.spyOn(net.Socket.prototype, 'connect')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await set('http://192.168.1.20:8188')
    await set('http://my-pc.local:8188')
    expect(connect).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
