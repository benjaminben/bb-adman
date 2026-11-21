import { describe, it, expect } from 'vitest'
import { LIVE_ENV_NAMES, liveEnvFrom } from '../../live/env-file'

// SPEC 13 [1.9]: made-up text only. No real file is read.
describe('liveEnvFrom picks the test:live variables from .env.local text [SPEC 13]', () => {
  it('holds exactly the names of Section 13', () => {
    expect([...LIVE_ENV_NAMES].sort()).toEqual(
      [
        'GEMINI_API_KEY',
        'FAL_KEY',
        'ADMAN_LIVE_S3_BUCKET',
        'ADMAN_LIVE_S3_REGION',
        'ADMAN_LIVE_S3_PREFIX',
        'ADMAN_LIVE_KEEP',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
      ].sort(),
    )
  })

  it('takes a listed name', () => {
    expect(liveEnvFrom('GEMINI_API_KEY=made-up-one\nADMAN_LIVE_KEEP=1\n', {})).toEqual({
      GEMINI_API_KEY: 'made-up-one',
      ADMAN_LIVE_KEEP: '1',
    })
  })

  it('drops a name that is not listed, so the file cannot switch on app flags', () => {
    const text = 'ADMAN_DEV_TOOLS=1\nADMAN_FAKE_PROVIDERS=1\nVITE_X=made-up\nFAL_KEY=made-up-two\n'
    expect(liveEnvFrom(text, {})).toEqual({ FAL_KEY: 'made-up-two' })
  })

  it('keeps the value of a name already set in the terminal', () => {
    const text = 'GEMINI_API_KEY=from-file\nFAL_KEY=from-file\n'
    expect(liveEnvFrom(text, { GEMINI_API_KEY: 'from-terminal' })).toEqual({
      FAL_KEY: 'from-file',
    })
  })

  it('gives nothing for empty text', () => {
    expect(liveEnvFrom('', {})).toEqual({})
  })
})
