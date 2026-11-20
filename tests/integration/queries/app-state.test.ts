import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '../../../src/shared/schemas/queries/app'

let f: Fixture
afterEach(() => f.cleanup())

describe('app.getState [SPEC 4.3, 6]', () => {
  it('lists the providers registered in this build with their availability', async () => {
    f = makeFixture()
    const s = data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
    expect(s.providers.map((p) => [p.id, p.available])).toEqual([
      ['gemini', true],
      ['fal-seedance', true],
      ['firefly', false],
      ['s3', true],
      ['dropbox', true],
      ['azure-blob', false],
      ['jev', false],
    ])
    expect(s.providers.find((p) => p.id === 'gemini')).toMatchObject({
      label: 'Google Gemini',
      jobs: ['image', 'layout', 'text'],
      secrets: ['gemini.apiKey'],
    })
  })

  it('adds the fake provider only when ADMAN_FAKE_PROVIDERS=1', async () => {
    f = makeFixture({ env: { ADMAN_FAKE_PROVIDERS: '1' } })
    const s = data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
    expect(s.providers.find((p) => p.id === 'fake')).toMatchObject({ available: true })
  })

  it('returns INVALID_INPUT for an unknown query', async () => {
    f = makeFixture()
    expect(await f.core.query('nope.nothing', {}, { actor: 'user' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})

describe('history.state [SPEC 4.3]', () => {
  it('rejects a malformed scope', async () => {
    f = makeFixture()
    expect(await f.core.query('history.state', { scope: 'nope' }, { actor: 'user' })).toMatchObject(
      {
        ok: false,
        error: { code: 'INVALID_INPUT' },
      },
    )
  })
})
