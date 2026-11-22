// R2E-10 (spec/phases/round-2-editor.md D8): the first-run mark is set by the user through
// settings.update; an agent is refused, as for every settings.update.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '@/shared/schemas/queries/app'

let f: Fixture
afterEach(() => f.cleanup())

const state = async () => data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))

describe('settings.update setup.done [R2E-10, D8]', () => {
  it('starts not done', async () => {
    f = makeFixture()
    expect((await state()).settings.setup).toEqual({ done: false })
  })

  it('the user sets it, and it is kept after a restart', async () => {
    f = makeFixture()
    expect((await f.user('settings.update', { setup: { done: true } })).ok).toBe(true)
    f.restart()
    expect((await state()).settings.setup).toEqual({ done: true })
  })

  it('an agent is refused with AGENT_DENIED and nothing changes', async () => {
    f = makeFixture()
    const result = await f.agent('settings.update', { setup: { done: true } })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect((await state()).settings.setup).toEqual({ done: false })
  })

  it('refuses an unknown key under setup', async () => {
    f = makeFixture()
    const result = await f.user('settings.update', { setup: { done: true, step: 1 } })
    expect(result.ok).toBe(false)
    expect((await state()).settings.setup).toEqual({ done: false })
  })
})
