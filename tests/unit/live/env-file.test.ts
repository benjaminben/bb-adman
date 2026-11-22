import { describe, it, expect } from 'vitest'
import { LIVE_ENV_NAMES, LIVE_REDACTED_NAMES, liveEnvFrom } from '../../live/env-file'
import { liveValues, safeText } from '../../live/live-output'

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
        'DROPBOX_ACCESS_TOKEN',
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

// P9-15: the Dropbox live test's token is read from .env.local and removed from what is
// printed; the app secret is removed too but never read from the file. Made-up values only.
describe('the Dropbox live values [P9-15, spec/storage-and-publish.md "Dropbox"]', () => {
  it('removes DROPBOX_ACCESS_TOKEN and DROPBOX_APP_SECRET from live output', () => {
    expect(LIVE_REDACTED_NAMES).toContain('DROPBOX_ACCESS_TOKEN')
    expect(LIVE_REDACTED_NAMES).toContain('DROPBOX_APP_SECRET')
    const values = liveValues({
      DROPBOX_ACCESS_TOKEN: 'made-up-dropbox-token',
      DROPBOX_APP_SECRET: 'made-up-app-secret',
    })
    const text = 'Bearer made-up-dropbox-token, secret made-up-app-secret'
    expect(safeText(text, values)).toBe('Bearer [key removed], secret [key removed]')
  })

  it('takes DROPBOX_ACCESS_TOKEN from the file and drops DROPBOX_APP_SECRET', () => {
    const text = 'DROPBOX_ACCESS_TOKEN=made-up-dropbox-token\nDROPBOX_APP_SECRET=made-up-secret\n'
    expect(liveEnvFrom(text, {})).toEqual({ DROPBOX_ACCESS_TOKEN: 'made-up-dropbox-token' })
  })
})
