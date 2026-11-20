import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState, HistoryState } from '../../../src/shared/schemas/queries'

let f: Fixture
afterEach(() => f.cleanup())

describe('app.getState [SPEC 4.3, 6]', () => {
  it('lists the providers registered in this build with their availability', async () => {
    f = makeFixture()
    const s = data<AppState>(await f.core.query('app.getState', {}))
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
    const s = data<AppState>(await f.core.query('app.getState', {}))
    expect(s.providers.find((p) => p.id === 'fake')).toMatchObject({ available: true })
  })

  it('returns INVALID_INPUT for an unknown query', async () => {
    f = makeFixture()
    expect(await f.core.query('nope.nothing', {})).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})

describe('history.state [SPEC 4.3]', () => {
  it('reports whether undo and redo are available for a scope', async () => {
    f = makeFixture()
    const empty = data<HistoryState>(
      await f.core.query('history.state', { scope: 'variant:abc234' }),
    )
    expect(empty).toEqual({ canUndo: false, canRedo: false })
    const p = data<{ projectId: string }>(
      await f.user('project.create', { name: 'A', location: f.projectsDir }),
    )
    f.core.undo.record(p.projectId, 'variant:abc234', { name: 'layer.update', input: {} })
    expect(
      data<HistoryState>(await f.core.query('history.state', { scope: 'variant:abc234' })),
    ).toEqual({
      canUndo: true,
      canRedo: false,
    })
  })

  it('rejects a malformed scope', async () => {
    f = makeFixture()
    expect(await f.core.query('history.state', { scope: 'nope' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})
