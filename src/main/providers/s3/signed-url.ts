// spec/approvals.md "Pictures": a signed read address for one object, made on this machine with
// @aws-sdk/s3-request-presigner (getSignedUrl with GetObjectCommand) on the adapter's own client,
// so the keys come from ctx.secret and nothing is sent. At most 604,800 seconds (7 days, the
// most S3 allows). The finished address is checked before it is handed out: https, one of
// s3Hosts, the object's own path, and a query of the signing fields only. The address holds a
// signature, so no error or log line holds it.
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { failureFromS3Error, s3Failure } from './failure'
import { s3Hosts } from './pinned-host'

export const SIGNED_URL_MAX_SECONDS = 604_800
export const REFUSED_LIFETIME = 'Signed address lifetime refused'

// The query fields a SigV4 presigned GetObject carries, with the values that are fixed. The SDK
// adds x-id (the operation) and x-amz-checksum-mode (from the client's checksum setting); both
// are signed, so they cannot be dropped.
const FIXED: Record<string, string | null> = {
  'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
  'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
  'X-Amz-Credential': null,
  'X-Amz-Date': null,
  'X-Amz-Expires': null,
  'X-Amz-Signature': null,
  'X-Amz-SignedHeaders': 'host',
  'x-id': 'GetObject',
}
const OPTIONAL: Record<string, string> = { 'x-amz-checksum-mode': 'ENABLED' }

export type SignedUrlExpected = { hosts: string[]; bucket: string; key: string; seconds: number }

function pathParts(url: URL, expected: SignedUrlExpected): boolean {
  const { hosts, bucket, key } = expected
  const want = url.hostname === hosts[0] ? key.split('/') : [bucket, ...key.split('/')]
  const got = url.pathname.split('/').slice(1).map(decodeURIComponent)
  return got.length === want.length && got.every((part, i) => part === want[i])
}

function queryFields(url: URL, seconds: number): boolean {
  const names = [...url.searchParams.keys()]
  if (new Set(names).size !== names.length) return false
  const fixed = { ...FIXED, 'X-Amz-Expires': String(seconds) }
  for (const [name, value] of Object.entries(fixed)) {
    const got = url.searchParams.get(name)
    if (got === null || got === '' || (value !== null && got !== value)) return false
  }
  return names.every((name) => name in fixed || url.searchParams.get(name) === OPTIONAL[name])
}

// True only for the address the adapter means to hand out.
export function checkSignedUrl(text: string, expected: SignedUrlExpected): boolean {
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.port !== '' || url.hash !== '') return false
    if (url.username !== '' || url.password !== '' || text.includes('#')) return false
    if (!expected.hosts.includes(url.hostname)) return false
    return pathParts(url, expected) && queryFields(url, expected.seconds)
  } catch {
    return false
  }
}

export type SignerSetup = { client: S3Client; bucket: string; keys: string[] }

// `key` is the whole object key, prefix included, already through the path rules.
export async function signReadUrl(setup: SignerSetup, key: string, seconds: number) {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > SIGNED_URL_MAX_SECONDS) {
    throw new Error(REFUSED_LIFETIME)
  }
  const { client, bucket, keys } = setup
  let url: string
  try {
    const region = await client.config.region()
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    url = await getSignedUrl(client, command, { expiresIn: seconds })
    if (checkSignedUrl(url, { hosts: s3Hosts(bucket, region), bucket, key, seconds })) return url
  } catch (error) {
    throw failureFromS3Error(error, keys)
  }
  throw s3Failure('other', 'Signed address refused: not the expected S3 address', keys)
}
