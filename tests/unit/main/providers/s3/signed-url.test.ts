// AP-7 (spec/approvals.md "Pictures", "Named tests"): the S3 adapter signs a read address on
// this machine. The address is for GET of one object, on one of s3Hosts, at the path the path
// rule gives, with nothing in its query but the signing fields; at most 604,800 seconds; the
// secret key is never in it; nothing is sent.
import { describe, it, expect } from 'vitest'
import { s3Storage } from '@/main/providers/s3/s3-storage'
import { S3Client } from '@aws-sdk/client-s3'
import { checkSignedUrl, signReadUrl, SIGNED_URL_MAX_SECONDS } from '@/main/providers/s3/signed-url'
import { ProviderFailure } from '@/main/providers/types'
import { s3Hosts } from '@/main/providers/s3/pinned-host'
import { REFUSED_PATH } from '@/main/providers/storage-paths'
import type { AdapterContext } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'
import { TEST_BUCKET, TEST_KEY_ID, TEST_SECRET, recordingHandler, testContext } from './recorded'

const FILE = 'adman-approvals/01JD5Z8Q4N3V6W7X8Y9Z0ABCDE/spring-sale-abc234/k3f9q2-3.png'
const SIGNING_FIELDS = [
  'X-Amz-Algorithm',
  'X-Amz-Content-Sha256',
  'X-Amz-Credential',
  'X-Amz-Date',
  'X-Amz-Expires',
  'X-Amz-Signature',
  'X-Amz-SignedHeaders',
  'x-amz-checksum-mode',
  'x-id',
]

function contextWith(bucket: string, prefix: string): AdapterContext {
  const settings = {
    storage: { s3: { bucket, region: 'eu-west-1', prefix }, dropbox: null },
  } as unknown as Settings
  return { ...testContext(), settings: () => settings }
}

function signer(ctx: AdapterContext) {
  const { seen, requestHandler } = recordingHandler(() => new Error('nothing may be sent'))
  const storage = s3Storage(ctx, { requestHandler })
  if (!storage.signedReadUrl) throw new Error('the S3 adapter has no signedReadUrl')
  return { seen, sign: storage.signedReadUrl.bind(storage) }
}

describe('S3 signedReadUrl: the address [spec/approvals.md "Pictures"]', () => {
  it.each([
    [
      'a bucket host',
      TEST_BUCKET,
      'made-up-prefix',
      `${TEST_BUCKET}.s3.eu-west-1.amazonaws.com`,
      `/made-up-prefix/${FILE}`,
    ],
    ['no prefix', TEST_BUCKET, '', `${TEST_BUCKET}.s3.eu-west-1.amazonaws.com`, `/${FILE}`],
    [
      'a bucket name with dots',
      'made.up.bucket',
      'p',
      's3.eu-west-1.amazonaws.com',
      `/made.up.bucket/p/${FILE}`,
    ],
  ])(
    'with %s: host, path and query are the expected ones',
    async (_case, bucket, prefix, host, path) => {
      const { seen, sign } = signer(contextWith(bucket, prefix))
      const url = new URL(await sign(FILE, SIGNED_URL_MAX_SECONDS))
      expect(s3Hosts(bucket, 'eu-west-1')).toContain(url.hostname)
      expect([url.protocol, url.host, url.pathname, url.hash]).toEqual(['https:', host, path, ''])
      expect([url.username, url.password]).toEqual(['', ''])
      expect([...url.searchParams.keys()].sort()).toEqual([...SIGNING_FIELDS].sort())
      expect(url.searchParams.get('X-Amz-Expires')).toBe('604800')
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host')
      expect(url.searchParams.get('x-id')).toBe('GetObject')
      expect(url.searchParams.get('X-Amz-Credential')?.startsWith(`${TEST_KEY_ID}/`)).toBe(true)
      expect(seen).toEqual([])
    },
  )

  it('never holds the secret key, plain or encoded', async () => {
    const url = await signer(testContext()).sign(FILE, 60)
    expect(url).not.toContain(TEST_SECRET)
    expect(url).not.toContain(encodeURIComponent(TEST_SECRET))
    expect(decodeURIComponent(url)).not.toContain(TEST_SECRET)
  })

  it('gives the lifetime asked for', async () => {
    const url = new URL(await signer(testContext()).sign(FILE, 3600))
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600')
  })
})

describe('S3 signedReadUrl: refusals [spec/approvals.md "Pictures"]', () => {
  it.each([604_801, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses a lifetime of %s seconds and sends nothing',
    async (seconds) => {
      const { seen, sign } = signer(testContext())
      await expect(sign(FILE, seconds)).rejects.toThrow('Signed address lifetime refused')
      expect(seen).toEqual([])
    },
  )

  it.each(['../x.png', '/a.png', 'a\\b.png', 'a//b.png'])('refuses the path %j', async (path) => {
    await expect(signer(testContext()).sign(path, 60)).rejects.toThrow(new Error(REFUSED_PATH))
  })
})

const HOSTS = s3Hosts(TEST_BUCKET, 'eu-west-1')
const KEY = `p/${FILE}`
const GOOD =
  `https://${TEST_BUCKET}.s3.eu-west-1.amazonaws.com/${KEY}?X-Amz-Algorithm=AWS4-HMAC-SHA256` +
  '&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=id%2F20261121%2Feu-west-1%2Fs3%2Faws4_request' +
  '&X-Amz-Date=20261121T000000Z&X-Amz-Expires=60&X-Amz-Signature=abc123&X-Amz-SignedHeaders=host' +
  '&x-amz-checksum-mode=ENABLED&x-id=GetObject'
const expected = { hosts: HOSTS, bucket: TEST_BUCKET, key: KEY, seconds: 60, region: 'eu-west-1' }

describe('checkSignedUrl: the adapter refuses an address it did not expect [spec/approvals.md "Pictures"]', () => {
  it('accepts the expected address', () => {
    expect(checkSignedUrl(GOOD, expected)).toBe(true)
    expect(checkSignedUrl(GOOD.replace('&x-amz-checksum-mode=ENABLED', ''), expected)).toBe(true)
  })

  it.each([
    ['another host', GOOD.replace(`${TEST_BUCKET}.s3.eu-west-1`, `${TEST_BUCKET}.s3.us-east-1`)],
    ['a look-alike host', GOOD.replace('amazonaws.com', 'amazonaws.com.example.net')],
    ['plain http', GOOD.replace('https:', 'http:')],
    ['a port', GOOD.replace('amazonaws.com/', 'amazonaws.com:8443/')],
    ['user info', GOOD.replace('https://', 'https://user@')],
    ['another path', GOOD.replace('/p/', '/q/')],
    ['an encoded slash', GOOD.replace('/p/adman-approvals', '/p%2Fadman-approvals')],
    ['the regional host without the bucket', GOOD.replace(`${TEST_BUCKET}.s3`, 's3')],
    ['an extra field', `${GOOD}&response-content-type=text/html`],
    ['a session token', `${GOOD}&X-Amz-Security-Token=t`],
    ['a field twice', `${GOOD}&x-id=GetObject`],
    ['another operation', GOOD.replace('x-id=GetObject', 'x-id=PutObject')],
    ['another lifetime', GOOD.replace('X-Amz-Expires=60', 'X-Amz-Expires=61')],
    ['more signed headers', GOOD.replace('SignedHeaders=host', 'SignedHeaders=host%3Bx-amz-acl')],
    ['a missing signature', GOOD.replace('&X-Amz-Signature=abc123', '')],
    ['a fragment', `${GOOD}#x`],
    ['not an address', 'not a url'],
    ['an inherited name: constructor', `${GOOD}&constructor=x`],
    ['an inherited name: __proto__', `${GOOD}&__proto__=x`],
    ['an inherited name: toString', `${GOOD}&toString=x`],
    ['an encoded path letter', GOOD.replace('/p/', '/%70/')],
    ['a dot-dot step', GOOD.replace('/p/', '/zzz/../p/')],
    ['an upper-case host', GOOD.replace('made-up-bucket.s3', 'MADE-UP-BUCKET.s3')],
    ['an explicit :443', GOOD.replace('amazonaws.com/', 'amazonaws.com:443/')],
    ['a trailing &', `${GOOD}&`],
    ['a credential for another region', GOOD.replace('%2Feu-west-1%2F', '%2Fus-east-1%2F')],
    ['a credential for another service', GOOD.replace('%2Fs3%2F', '%2Fs4%2F')],
  ])('refuses %s', (_case, url) => {
    expect(checkSignedUrl(url, expected)).toBe(false)
  })

  it('accepts the path-style address only on the regional host', () => {
    const dotted = { ...expected, hosts: s3Hosts('a.b.c', 'eu-west-1'), bucket: 'a.b.c' }
    const pathStyle = GOOD.replace(
      `${TEST_BUCKET}.s3.eu-west-1.amazonaws.com/`,
      's3.eu-west-1.amazonaws.com/a.b.c/',
    )
    expect(checkSignedUrl(pathStyle, dotted)).toBe(true)
    expect(checkSignedUrl(pathStyle.replace('/a.b.c/', '/'), dotted)).toBe(false)
  })
})

describe('signReadUrl: a client that signs for an unexpected address [spec/approvals.md "Pictures"]', () => {
  it.each([
    ['another endpoint', 'https://made-up.example.com', 'eu-west-1'],
    ['another region than the endpoint', 'https://s3.eu-west-1.amazonaws.com', 'us-east-1'],
  ])(
    'with %s it refuses, and the error holds no address and no key',
    async (_case, endpoint, region) => {
      const client = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId: TEST_KEY_ID, secretAccessKey: TEST_SECRET },
      })
      const setup = { client, bucket: TEST_BUCKET, keys: [TEST_KEY_ID, TEST_SECRET] }
      const error: unknown = await signReadUrl(setup, KEY, 60).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ProviderFailure)
      const failure = error as ProviderFailure
      expect(failure.error.detail).toBe('Signed address refused: not the expected S3 address')
      const shown = JSON.stringify([failure.message, failure.error, failure.stack])
      for (const secret of [TEST_KEY_ID, TEST_SECRET, 'X-Amz-Signature', 'https://', KEY]) {
        expect(shown).not.toContain(secret)
      }
    },
  )
})
