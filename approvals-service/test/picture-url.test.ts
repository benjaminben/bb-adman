import { describe, it, expect } from 'vitest'
import { db } from './db'
import { checkPictureUrl } from '../src/pictures/check-url'
import type { Env } from '../src/env'

const plain: Env = { DB: db }
const testing: Env = { DB: db, TEST_PICTURE_ORIGIN: 'http://127.0.0.1:8787' }
const BUCKET = 'https://my-bucket.s3.eu-west-1.amazonaws.com/campaigns/a.png?X-Amz-Signature=ab'
const PATH_STYLE = 'https://s3.us-east-1.amazonaws.com/my-bucket/a.png'
const HOST = 'bucket.s3.us-east-1.amazonaws.com'
const CLEAN = `https://${HOST}/a.png`

// The expected answer: the cleaned address that would be stored, or null for a refusal.
type Row = [name: string, url: string, env: Env, expected: string | null]

const rows: Row[] = [
  ['a bucket host', BUCKET, plain, BUCKET],
  ['a path-style host', PATH_STYLE, plain, PATH_STYLE],
  ['a host in capitals', BUCKET.replace('my-bucket.s3', 'My-Bucket.S3'), plain, BUCKET],
  ['port 443 written out', PATH_STYLE.replace('.com/', '.com:443/'), plain, PATH_STYLE],
  ['the backslash form', `https:\\\\${HOST}\\a.png`, plain, CLEAN],
  ['spaces round the address', `  ${CLEAN}  `, plain, CLEAN],
  ['full-width dots in the host', `https://${HOST.replaceAll('.', '．')}/a.png`, plain, CLEAN],
  [
    'the test origin with TEST_PICTURE_ORIGIN',
    'http://127.0.0.1:8787/pic/a.png',
    testing,
    'http://127.0.0.1:8787/pic/a.png',
  ],
  ['S3 while testing still works', BUCKET, testing, BUCKET],
  ['http:', BUCKET.replace('https:', 'http:'), plain, null],
  ['another scheme', BUCKET.replace('https:', 'ftp:'), plain, null],
  ['a data address', 'data:image/png;base64,iVBORw0KGgo=', plain, null],
  ['another host', 'https://example.com/a.png', plain, null],
  ['amazonaws.com.evil.example', 'https://s3.us-east-1.amazonaws.com.evil.example/a', plain, null],
  ['a bucket under another domain', 'https://b.s3.us-east-1.amazonaws.co/a', plain, null],
  ['a trailing dot on the host', `https://${HOST}./a.png`, plain, null],
  // The URL parser decodes %2E in a host to a dot, so this is the same host, stored cleaned.
  ['%2E in the host', `https://${HOST.replaceAll('.', '%2E')}/a.png`, plain, CLEAN],
  ['a port', PATH_STYLE.replace('.com/', '.com:8443/'), plain, null],
  ['a user name', PATH_STYLE.replace('https://', 'https://me@'), plain, null],
  ['a user name and password', PATH_STYLE.replace('https://', 'https://me:pw@'), plain, null],
  ['the S3 host as a user name', `https://${HOST}@evil.example/`, plain, null],
  ['evil host with a backslash before @', `https://evil.example\\@${HOST}/`, plain, null],
  ['an IP address', 'https://52.216.0.1/my-bucket/a.png', plain, null],
  ['a decimal IP address', 'https://886571009/a.png', plain, null],
  ['a hex IP address', 'https://0x34d80001/a.png', plain, null],
  ['an IPv6 address', 'https://[::1]/a.png', plain, null],
  ['not an address', 'my-bucket.s3.eu-west-1.amazonaws.com/a.png', plain, null],
  ['the test origin without TEST_PICTURE_ORIGIN', 'http://127.0.0.1:8787/a.png', plain, null],
  ['a different test port', 'http://127.0.0.1:8788/a.png', testing, null],
  ['the test origin over https', 'https://127.0.0.1:8787/a.png', testing, null],
  ['the test origin with a user name', 'http://me@127.0.0.1:8787/a.png', testing, null],
  ['localhost for the test origin', 'http://localhost:8787/a.png', testing, null],
  [
    'a test origin value that is not 127.0.0.1',
    'http://10.0.0.1:8787/a.png',
    { DB: db, TEST_PICTURE_ORIGIN: 'http://10.0.0.1:8787' },
    null,
  ],
  [
    'a test origin value with a path',
    'http://127.0.0.1:8787/a.png',
    { DB: db, TEST_PICTURE_ORIGIN: 'http://127.0.0.1:8787/' },
    null,
  ],
]

describe('checkPictureUrl [approvals-service.md "Pictures"]', () => {
  it.each(rows)('%s', (_name, url, checkEnv, expected) => {
    expect(checkPictureUrl(url, checkEnv)).toBe(expected)
  })
})
