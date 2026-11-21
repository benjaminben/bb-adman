import { describe, it, expect } from 'vitest'
import { realAppEnv } from '../../e2e-real/real-env'

const TERMINAL = {
  PATH: '/usr/bin',
  HOME: '/Users/someone',
  ADMAN_FAKE_PROVIDERS: '1',
  COMFY_BASE_URL: 'http://192.0.2.10:8188',
  GEMINI_API_KEY: 'made-up-not-a-key',
  ADMAN_E2E_PICTURES: '/p/one.png',
  ADMAN_E2E_FLUX: '1',
  ADMAN_DEV_TOOLS: '0',
}

describe('the app started by launchReal [SPEC 14 1.56 E2E-R, Launch]', () => {
  const env = realAppEnv(TERMINAL, '/tmp/box/userData')

  it('has no fake providers and has the hand-test tools on', () => {
    expect(env.ADMAN_FAKE_PROVIDERS).toBeUndefined()
    expect(env.ADMAN_DEV_TOOLS).toBe('1')
  })

  it('uses the sandbox app data folder', () => {
    expect(env.ADMAN_USER_DATA_DIR).toBe('/tmp/box/userData')
  })

  it('is not handed the address, the key, the photo paths or the switches', () => {
    const hidden = ['COMFY_BASE_URL', 'GEMINI_API_KEY', 'ADMAN_E2E_PICTURES', 'ADMAN_E2E_FLUX']
    for (const name of hidden) expect(env[name]).toBeUndefined()
  })

  it('keeps the rest of the terminal, so Electron starts as usual', () => {
    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/Users/someone')
  })
})
