// approvals.setService (spec/approvals.md "approvals.setService", "Settings"): the one writer of
// approvals.baseUrl. Contacts nothing.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { APPROVALS_ADDRESS_MESSAGE } from '@/shared/approvals/messages'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

// The core reads deps.devTools when the command runs; the fixture builds it with false.
const withDevTools = (fx: Fixture) => Object.assign(fx.core.deps, { devTools: true })
const set = (fx: Fixture, address: unknown) => fx.user('approvals.setService', { address })
const saved = (fx: Fixture) =>
  JSON.parse(fs.readFileSync(path.join(fx.userData, 'settings.json'), 'utf8')).approvals
const changed = { name: 'app.stateChanged', payload: {} }

describe('approvals.setService [spec/approvals.md "approvals.setService"]', () => {
  it('saves the origin of an accepted address and sends app.stateChanged', async () => {
    f = makeFixture()
    expect(await set(f, ' https://Approvals.Example.com/ ')).toEqual({
      ok: true,
      data: { baseUrl: 'https://approvals.example.com' },
    })
    expect(f.core.settings.get().approvals).toEqual({ baseUrl: 'https://approvals.example.com' })
    expect(saved(f)).toEqual({ baseUrl: 'https://approvals.example.com' })
    expect(f.events).toContainEqual(changed)
  })

  it('keeps the address after a restart', async () => {
    f = makeFixture()
    await set(f, 'https://approvals.example.com:8443')
    f.restart()
    expect(f.core.settings.get().approvals).toEqual({
      baseUrl: 'https://approvals.example.com:8443',
    })
  })

  it('removes the address with null', async () => {
    f = makeFixture()
    await set(f, 'https://approvals.example.com')
    expect(await set(f, null)).toEqual({ ok: true, data: { baseUrl: null } })
    expect(saved(f)).toEqual({ baseUrl: null })
  })

  it.each([
    'http://approvals.example.com',
    'http://127.0.0.1:8787',
    'https://127.0.0.1',
    'https://localhost',
    'https://approvals.example.com/path',
    'https://user:pw@approvals.example.com',
    'approvals',
    '',
  ])('refuses %j with the rule sentence, writes nothing and sends no event', async (text) => {
    f = makeFixture()
    await set(f, 'https://approvals.example.com')
    const before = f.events.length
    expect(await set(f, text)).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: APPROVALS_ADDRESS_MESSAGE },
    })
    expect(saved(f)).toEqual({ baseUrl: 'https://approvals.example.com' })
    expect(f.events.slice(before)).not.toContainEqual(changed)
  })

  it('accepts the local test address only with dev tools', async () => {
    f = makeFixture()
    withDevTools(f)
    expect(await set(f, 'http://127.0.0.1:8787')).toEqual({
      ok: true,
      data: { baseUrl: 'http://127.0.0.1:8787' },
    })
    expect(f.core.settings.get().approvals).toEqual({ baseUrl: 'http://127.0.0.1:8787' })
    expect(await set(f, 'http://approvals.example.com')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('refuses an input that is not text or null', async () => {
    f = makeFixture()
    expect(await set(f, 42)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(
      await f.user('approvals.setService', { address: 'https://a.example.com', devTools: true }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })

  it('is refused to an agent', async () => {
    f = makeFixture()
    expect(
      await f.agent('approvals.setService', { address: 'https://approvals.example.com' }),
    ).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(f.core.settings.get().approvals).toEqual({ baseUrl: null })
  })
})
