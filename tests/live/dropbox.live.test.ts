// P9-15 (spec/storage-and-publish.md "Dropbox", "Live test"): the stakeholder's own check against
// his real Dropbox app folder, with a short-lived DROPBOX_ACCESS_TOKEN made in the Dropbox console
// (from the terminal or .env.local). Run by hand with
// `npm run test:live -- tests/live/dropbox.live.test.ts`; never by npm test, CI or an agent.
// One file is uploaded, listed and removed, all under adman-live-test/ in the app folder: that
// is the adapter's root, so no path it is given can leave that folder. The token reaches only
// the adapter's `accessToken` option and the pinned fetch, which sends it to the two Dropbox API
// hosts only. Nothing printed holds the token or an address; a failure is let out as its safe
// text only (live-output.ts), with no cause. A missing token skips with one line, and a refused
// (expired) token too.
import { describe, it, expect } from 'vitest'
import { dropboxStorage } from '@/main/providers/dropbox/dropbox-storage'
import { pinnedFetch } from '@/main/providers/dropbox/pinned-fetch'
import { ProviderFailure, type AdapterContext } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'
import { livePrint, missingNames, safeFailure } from './live-output'

const ROOT = 'adman-live-test'
const HAND_FILE = 'hello.txt'
const where = `${ROOT}/${HAND_FILE}`
const missing = missingNames(['DROPBOX_ACCESS_TOKEN']).length > 0

if (missing) process.stdout.write('Dropbox live test skipped: not set: DROPBOX_ACCESS_TOKEN\n')

// No secret is read through the context: the token goes in as the `accessToken` option.
function liveContext(): AdapterContext {
  const settings = {
    storage: { s3: null, dropbox: { accountName: '', rootPath: ROOT } },
  } as unknown as Settings
  return {
    secret: () => {
      throw new Error('The Dropbox live test reads no saved secret')
    },
    settings: () => settings,
    model: () => 'none',
  }
}

const isRefused = (e: unknown) => e instanceof ProviderFailure && e.error.kind === 'bad_key'

describe.skipIf(missing)('Dropbox, live [P9-15, OI-18]', () => {
  it('uploads a file, lists it and removes it', { timeout: 60_000 }, async (ctx) => {
    const storage = dropboxStorage(liveContext(), {
      fetch: pinnedFetch(),
      accessToken: process.env.DROPBOX_ACCESS_TOKEN,
    })
    const body = new TextEncoder().encode(`Adman live test ${new Date().toISOString()}\n`)
    try {
      await storage.write(HAND_FILE, body, 'text/plain')
      expect(await storage.list('')).toContain(HAND_FILE)
      livePrint([`Dropbox live: uploaded and listed ${where}`])
      await storage.remove([HAND_FILE])
      expect(await storage.exists(HAND_FILE)).toBe(false)
      livePrint([`Dropbox live: removed ${where}`])
    } catch (e) {
      if (isRefused(e)) {
        livePrint(['Dropbox live test skipped: the token was refused (expired?); make a new one'])
        return ctx.skip()
      }
      const failed = safeFailure('Dropbox', e)
      livePrint(failed.lines)
      throw failed.error
    }
  })
})
