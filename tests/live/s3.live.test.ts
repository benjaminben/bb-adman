// SPEC 6.5, 13, 14 slice F: the storage conformance cases and one hand test against a real
// S3 bucket, with the developer's own keys. Run by hand with `npm run test:live`; never part
// of `npm test` or CI. Everything is written under {prefix}/adman-hand-test/ and nowhere else.
// ADMAN_LIVE_KEEP=1 leaves adman-hand-test/hello.txt in the bucket; the next run removes it.
// The keys reach the adapter only through AdapterContext.secret. No key, bucket name or
// prefix is printed.
import { describe, it, expect } from 'vitest'
import { s3Storage } from '../../src/main/providers/s3/s3-storage'
import type { AdapterContext } from '../../src/main/providers/types'
import type { Settings } from '../../src/shared/schemas/settings'
import { describeStorageConformance } from '../integration/providers/storage-conformance'

const env = process.env
const bucket = env.ADMAN_LIVE_S3_BUCKET
const region = env.ADMAN_LIVE_S3_REGION
const prefix = (env.ADMAN_LIVE_S3_PREFIX ?? '').replace(/^\/+|\/+$/g, '')
const keyId = env.AWS_ACCESS_KEY_ID
const secret = env.AWS_SECRET_ACCESS_KEY
const keep = env.ADMAN_LIVE_KEEP === '1'
const missing = !bucket || !region || !keyId || !secret
const HAND_FILE = 'hello.txt'
const where = `{prefix}/adman-hand-test/${HAND_FILE}`

if (missing) {
  process.stdout.write(
    'S3 live test skipped: set ADMAN_LIVE_S3_BUCKET, ADMAN_LIVE_S3_REGION, ' +
      'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (ADMAN_LIVE_S3_PREFIX is optional)\n',
  )
}

// The adapter's root is {prefix}/adman-hand-test, so no path it is given can leave that folder.
function liveContext(): AdapterContext {
  const secrets: Record<string, string | undefined> = {
    's3.accessKeyId': keyId,
    's3.secretAccessKey': secret,
  }
  const root = prefix === '' ? 'adman-hand-test' : `${prefix}/adman-hand-test`
  const settings = {
    storage: { s3: { bucket: bucket ?? '', region: region ?? '', prefix: root }, dropbox: null },
  } as unknown as Settings
  return {
    secret(name) {
      const value = secrets[name]
      if (value === undefined) throw new Error(`No live value for ${name}`)
      return value
    },
    settings: () => settings,
    model: () => 'none',
  }
}

describeStorageConformance('S3 bucket, live', () => s3Storage(liveContext()), {
  timeout: 60_000,
  skip: missing,
})

describe.skipIf(missing)('S3 hand test, live [SPEC 6.5, slice F]', () => {
  it('uploads a file, lists it, reads it back and removes it', { timeout: 60_000 }, async () => {
    const storage = s3Storage(liveContext())
    const body = new TextEncoder().encode(`Adman hand test ${new Date().toISOString()}\n`)
    await storage.write(HAND_FILE, body, 'text/plain')
    expect(await storage.list('')).toContain(HAND_FILE)
    expect(await storage.read(HAND_FILE)).toEqual(body)
    process.stdout.write(`S3 live: uploaded, listed and read ${where}\n`)
    if (keep) {
      process.stdout.write(`S3 live: ADMAN_LIVE_KEEP=1, so ${where} stays in the bucket\n`)
      return
    }
    await storage.remove([HAND_FILE])
    expect(await storage.exists(HAND_FILE)).toBe(false)
    process.stdout.write(`S3 live: removed ${where}\n`)
  })
})
