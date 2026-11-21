import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { checkPictureUrl } from '../src/pictures/check-url'
import type { Env } from '../src/env'

const plain: Env = { DB: env.DB }
const testing: Env = { DB: env.DB, TEST_PICTURE_ORIGIN: 'http://127.0.0.1:8787' }
const BUCKET = 'https://my-bucket.s3.eu-west-1.amazonaws.com/campaigns/a.png?X-Amz-Signature=ab'
const PATH_STYLE = 'https://s3.us-east-1.amazonaws.com/my-bucket/a.png'

type Row = [name: string, url: string, env: Env, allowed: boolean]

const rows: Row[] = [
  ['a bucket host', BUCKET, plain, true],
  ['a path-style host', PATH_STYLE, plain, true],
  ['a host in capitals', BUCKET.replace('my-bucket.s3', 'My-Bucket.S3'), plain, true],
  ['port 443 written out', PATH_STYLE.replace('.com/', '.com:443/'), plain, true],
  ['the test origin with TEST_PICTURE_ORIGIN', 'http://127.0.0.1:8787/pic/a.png', testing, true],
  ['http:', BUCKET.replace('https:', 'http:'), plain, false],
  ['another scheme', BUCKET.replace('https:', 'ftp:'), plain, false],
  ['a data address', 'data:image/png;base64,iVBORw0KGgo=', plain, false],
  ['another host', 'https://example.com/a.png', plain, false],
  ['amazonaws.com.evil.example', 'https://s3.us-east-1.amazonaws.com.evil.example/a', plain, false],
  ['a bucket under another domain', 'https://b.s3.us-east-1.amazonaws.co/a', plain, false],
  ['a port', PATH_STYLE.replace('.com/', '.com:8443/'), plain, false],
  ['a user name', PATH_STYLE.replace('https://', 'https://me@'), plain, false],
  ['a user name and password', PATH_STYLE.replace('https://', 'https://me:pw@'), plain, false],
  ['an IP address', 'https://52.216.0.1/my-bucket/a.png', plain, false],
  ['an IPv6 address', 'https://[::1]/a.png', plain, false],
  ['not an address', 'my-bucket.s3.eu-west-1.amazonaws.com/a.png', plain, false],
  ['the test origin without TEST_PICTURE_ORIGIN', 'http://127.0.0.1:8787/a.png', plain, false],
  ['a different test port', 'http://127.0.0.1:8788/a.png', testing, false],
  ['the test origin over https', 'https://127.0.0.1:8787/a.png', testing, false],
  ['the test origin with a user name', 'http://me@127.0.0.1:8787/a.png', testing, false],
  ['localhost for the test origin', 'http://localhost:8787/a.png', testing, false],
  [
    'a test origin value that is not 127.0.0.1',
    'http://10.0.0.1:8787/a.png',
    { DB: env.DB, TEST_PICTURE_ORIGIN: 'http://10.0.0.1:8787' },
    false,
  ],
  [
    'a test origin value with a path',
    'http://127.0.0.1:8787/a.png',
    { DB: env.DB, TEST_PICTURE_ORIGIN: 'http://127.0.0.1:8787/' },
    false,
  ],
  ['S3 while testing still works', BUCKET, testing, true],
]

describe('checkPictureUrl [approvals-service.md "Pictures"]', () => {
  it.each(rows)('%s', (_name, url, checkEnv, allowed) => {
    expect(checkPictureUrl(url, checkEnv)).toBe(allowed)
  })
})
