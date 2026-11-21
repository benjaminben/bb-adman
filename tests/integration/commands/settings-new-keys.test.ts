import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '../../../src/shared/schemas/queries/app'

let f: Fixture
afterEach(() => f.cleanup())

const state = async () => data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))

describe('settings loader and the two 1.24 keys [SPEC 13.1, 14 CU-0]', () => {
  it('fills comfyui and agentRuns with their defaults for a file from before 1.24', async () => {
    f = makeFixture()
    fs.mkdirSync(f.userData, { recursive: true })
    const old = { ...(await state()).settings, generation: { optionsPerRun: 2 } } as Record<
      string,
      unknown
    >
    delete old.comfyui
    delete old.agentRuns
    fs.writeFileSync(path.join(f.userData, 'settings.json'), JSON.stringify(old))
    f.restart()
    const s = (await state()).settings
    expect(s.generation.optionsPerRun).toBe(2)
    expect(s.comfyui).toEqual({ baseUrl: null })
    expect(s.agentRuns).toEqual({})
  })

  it('refuses a settings.update patch that names either key, and changes nothing', async () => {
    f = makeFixture()
    const before = (await state()).settings
    const patches = [
      { comfyui: { baseUrl: 'http://192.0.2.10:8188' } },
      { agentRuns: { comfyui: { allowed: true } } },
    ]
    for (const patch of patches) {
      expect(await f.user('settings.update', patch)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      })
    }
    expect((await state()).settings).toEqual(before)
  })
})

describe('a hand-edited comfyui address is read as none until CU-1 [SPEC 13.1, 14 CU-0 W6]', () => {
  it.each([
    ['http://169.254.169.254', null],
    ['http://127.0.0.1:8188', 'http://127.0.0.1:8188'],
  ])(
    'loads a settings.json holding %s with baseUrl %s and the other keys as written',
    async (baseUrl, expected) => {
      f = makeFixture()
      fs.mkdirSync(f.userData, { recursive: true })
      const written = {
        ...(await state()).settings,
        generation: { optionsPerRun: 2 },
        export: { imageFormat: 'jpg', jpgQuality: 80, fps: 60 },
        comfyui: { baseUrl },
      }
      const file = path.join(f.userData, 'settings.json')
      const text = JSON.stringify(written)
      fs.writeFileSync(file, text)
      f.restart()
      const s = (await state()).settings
      expect(s.comfyui).toEqual({ baseUrl: expected })
      expect(s).toEqual({ ...written, comfyui: { baseUrl: expected } })
      expect(fs.readFileSync(file, 'utf8')).toBe(text)
    },
  )
})

describe('settings.update and the comfyui row [SPEC 6.11.1, 14 CU-0 W5]', () => {
  it('refuses comfyui as the default image provider while its row is not available', async () => {
    f = makeFixture()
    const before = await state()
    expect(before.providers.find((p) => p.id === 'comfyui')).toMatchObject({
      available: true,
      jobs: ['image'],
    })
    expect(
      await f.user('settings.update', { defaultProviders: { image: 'comfyui' } }),
    ).toMatchObject({ ok: true })
    expect((await state()).settings.defaultProviders.image).toBe('comfyui')
  })
})
