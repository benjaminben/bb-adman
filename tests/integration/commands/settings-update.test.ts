import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '@/shared/schemas/queries/app'

let f: Fixture
afterEach(() => f.cleanup())

const state = async () => data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))

describe('settings defaults [SPEC 13.1]', () => {
  it('starts from the SPEC 13.1 defaults on first run', async () => {
    f = makeFixture()
    expect((await state()).settings).toEqual({
      defaultProjectDir: path.join(f.documents, 'Adman Projects'),
      recentProjects: [],
      defaultProviders: {
        image: 'gemini',
        layout: 'gemini',
        text: 'gemini',
        video: 'comfyui',
      },
      generation: { optionsPerRun: 4 },
      export: { imageFormat: 'png', jpgQuality: 90, fps: 30 },
      mcp: { enabled: false, port: 47821, autoApproveDestructive: false },
      storage: { s3: null, dropbox: null },
      comfyui: { baseUrl: null },
      agentRuns: {},
    })
  })

  it('falls back to defaults when settings.json is unreadable', async () => {
    f = makeFixture()
    fs.mkdirSync(f.userData, { recursive: true })
    fs.writeFileSync(path.join(f.userData, 'settings.json'), '{ not json')
    f.restart()
    expect((await state()).settings.generation.optionsPerRun).toBe(4)
  })
})

describe('settings.update [FR-004, FR-067, FR-170]', () => {
  it('changes the default project location and keeps it after a restart', async () => {
    f = makeFixture()
    const dir = path.join(f.root, 'Elsewhere')
    expect((await f.user('settings.update', { defaultProjectDir: dir })).ok).toBe(true)
    f.restart()
    expect((await state()).settings.defaultProjectDir).toBe(dir)
  })

  it('merges a nested patch without touching sibling values', async () => {
    f = makeFixture()
    await f.user('settings.update', { export: { fps: 60 }, defaultProviders: { text: 'gemini' } })
    const s = (await state()).settings
    expect(s.export).toEqual({ imageFormat: 'png', jpgQuality: 90, fps: 60 })
    expect(s.defaultProviders.video).toBe('comfyui')
  })

  it('emits app.stateChanged', async () => {
    f = makeFixture()
    await f.user('settings.update', { generation: { optionsPerRun: 2 } })
    expect(f.events.map((e) => e.name)).toContain('app.stateChanged')
  })

  it.each([
    [{ defaultProjectDir: 'relative' }],
    [{ export: { fps: 24 } }],
    [{ export: { jpgQuality: 101 } }],
    [{ generation: { optionsPerRun: 0 } }],
    [{ defaultProviders: { image: 'nobody' } }],
    [{ defaultProviders: { image: 'fal-seedance' } }],
    [{ defaultProviders: { image: 'firefly' } }],
    [{ recentProjects: [] }],
    [{ mcp: { enabled: true } }],
    [{ unknownSetting: 1 }],
  ])('rejects %j with INVALID_INPUT and changes nothing', async (patch) => {
    f = makeFixture()
    const before = (await state()).settings
    expect(await f.user('settings.update', patch)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect((await state()).settings).toEqual(before)
  })

  it('is denied to agents', async () => {
    f = makeFixture()
    expect(await f.agent('settings.update', { generation: { optionsPerRun: 2 } })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
  })
})
