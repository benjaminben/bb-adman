// Test helper for checkS3Access: a stand-in request handler that tells the four calls apart
// and answers each with a recorded reply (or a given one). Requests pass through the real
// S3 client and the real host pin first (buildS3Client).
import { recordingHandler, xml, ok, type Answer, type SeenRequest } from './recorded'
import type { S3CheckStep } from '@/shared/schemas/commands/storage-check'

export const CHECK_TEXT = 'Adman connection check. Safe to delete.'

export function errorXml(code: string, status: number, extra = ''): Answer {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>${code}</Code><Message>Made-up message for ${code}</Message>${extra}<RequestId>0A49CE4060975EAC</RequestId><HostId>bWFkZS11cC1ob3N0LWlk</HostId></Error>`
  return { status, headers: { 'content-type': 'application/xml' }, body }
}

export const REPLIES = {
  invalidKeyId: () => xml('error-invalid-access-key-id.xml', 403),
  badSignature: () => xml('error-signature-does-not-match.xml', 403),
  accessDenied: () => xml('error-access-denied.xml', 403),
  noSuchBucket: () => xml('error-no-such-bucket.xml', 404),
  slowDown: () => xml('error-slow-down.xml', 503),
  requestTimeout: () => xml('error-request-timeout.xml', 400),
  internal: () => xml('error-internal.xml', 500),
  deleteErrors: () => xml('delete-objects-error.xml'),
}

const SUCCESS: Record<S3CheckStep, () => Answer> = {
  list: () => xml('list-objects-v2-empty.xml'),
  write: () => ok({ etag: '"made-up"' }),
  read: () => ({
    status: 200,
    headers: { 'content-type': 'text/plain', 'content-length': String(CHECK_TEXT.length) },
    body: CHECK_TEXT,
  }),
  delete: () => xml('delete-objects-quiet.xml'),
}

export function stepOf(request: SeenRequest): S3CheckStep | 'unknown' {
  if (request.method === 'GET' && request.query['list-type'] === '2') return 'list'
  if (request.method === 'PUT') return 'write'
  if (request.method === 'GET') return 'read'
  if (request.method === 'POST' && 'delete' in request.query) return 'delete'
  return 'unknown'
}

export type Overrides = Partial<Record<S3CheckStep, Answer | Error>>

// Answers each call by its step: the override when given, the recorded success otherwise.
export function checkStandIn(overrides: Overrides = {}) {
  return recordingHandler((request) => {
    const step = stepOf(request)
    if (step === 'unknown') throw new Error(`unexpected request ${request.method}`)
    return overrides[step] ?? SUCCESS[step]()
  })
}

// The object keys named in a DeleteObjects body.
export function deletedKeys(request: SeenRequest): string[] {
  const text = new TextDecoder().decode(request.body)
  return [...text.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => m[1] ?? '')
}

// The object key a PUT or GET names (virtual-hosted style: the path is '/' + key).
export function keyOf(request: SeenRequest): string {
  return decodeURIComponent(request.path.replace(/^\//, ''))
}
