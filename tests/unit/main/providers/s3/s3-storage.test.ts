import { describe, it, expect, afterEach } from 'vitest'
import { s3Storage } from '@/main/providers/s3/s3-storage'
import { adapters } from '@/main/providers/s3'
import { ProviderFailure } from '@/main/providers/types'
import {
  TEST_KEY_ID,
  TEST_SECRET,
  handlerAnswering,
  ok,
  recordingHandler,
  testContext,
  xml,
} from './recorded'

const text = (value: string) => new TextEncoder().encode(value)
const HOST = 'made-up-bucket.s3.eu-west-1.amazonaws.com'

function first<T>(list: T[]): T {
  const item = list[0]
  if (item === undefined) throw new Error('expected at least one entry')
  return item
}

describe('S3 storage: write [SPEC 6.5]', () => {
  it('puts a small file at {prefix}/{path} with its content type and bytes', async () => {
    const { seen, requestHandler } = handlerAnswering(ok({ etag: '"made-up"' }))
    await s3Storage(testContext(), { requestHandler }).write('a/b.txt', text('hi'), 'text/plain')
    const put = first(seen)
    expect([put.method, put.hostname, put.path]).toEqual(['PUT', HOST, '/made-up-prefix/a/b.txt'])
    expect(put.headers['content-type']).toBe('text/plain')
    expect(put.body).toEqual(text('hi'))
  })

  it('uploads a stream with all of its bytes', async () => {
    const { seen, requestHandler } = handlerAnswering(ok({ etag: '"made-up"' }))
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(text('hello '))
        controller.enqueue(text('world'))
        controller.close()
      },
    })
    await s3Storage(testContext(), { requestHandler }).write('s.txt', stream, 'text/plain')
    expect(first(seen).body).toEqual(text('hello world'))
  })

  it('uses a multipart upload for a file larger than one part', async () => {
    const { seen, requestHandler } = recordingHandler((request) => {
      if (request.method === 'POST' && 'uploads' in request.query) {
        return xml('create-multipart-upload.xml')
      }
      if (request.method === 'PUT')
        return ok({ etag: `"part-${String(request.query.partNumber)}"` })
      return xml('complete-multipart-upload.xml')
    })
    const big = new Uint8Array(5 * 1024 * 1024 + 10).fill(7)
    await s3Storage(testContext(), { requestHandler }).write('big.bin', big, 'video/mp4')
    const parts = seen.filter((r) => r.method === 'PUT')
    expect(parts.map((r) => r.query.uploadId)).toEqual(['made-up-upload-id', 'made-up-upload-id'])
    expect(parts.reduce((sum, r) => sum + r.body.length, 0)).toBe(big.length)
    const complete = seen.at(-1)
    expect([complete?.method, complete?.query.uploadId]).toEqual(['POST', 'made-up-upload-id'])
  })

  it('stops a multipart upload that fails, and throws a ProviderFailure', async () => {
    const { seen, requestHandler } = recordingHandler((request) => {
      if (request.method === 'POST' && 'uploads' in request.query) {
        return xml('create-multipart-upload.xml')
      }
      if (request.method === 'PUT') return xml('error-internal.xml', 500)
      return ok()
    })
    const big = new Uint8Array(5 * 1024 * 1024 + 10)
    const call = s3Storage(testContext(), { requestHandler }).write('big.bin', big, 'video/mp4')
    await expect(call).rejects.toBeInstanceOf(ProviderFailure)
    expect(
      seen.some((r) => r.method === 'DELETE' && r.query.uploadId === 'made-up-upload-id'),
    ).toBe(true)
  })
})

describe('S3 storage: exists, read, list, remove [SPEC 6.5]', () => {
  it('exists asks for the object head: 200 is true, 404 is false', async () => {
    const { seen, requestHandler } = handlerAnswering(ok(), { status: 404 })
    const storage = s3Storage(testContext(), { requestHandler })
    expect(await storage.exists('a.txt')).toBe(true)
    expect(await storage.exists('gone.txt')).toBe(false)
    expect(seen.map((r) => [r.method, r.path])).toEqual([
      ['HEAD', '/made-up-prefix/a.txt'],
      ['HEAD', '/made-up-prefix/gone.txt'],
    ])
  })

  it('read gives the object bytes', async () => {
    const bytes = new Uint8Array([0, 1, 254, 255])
    const { seen, requestHandler } = handlerAnswering({ status: 200, body: bytes })
    expect(await s3Storage(testContext(), { requestHandler }).read('x.bin')).toEqual(bytes)
    expect([first(seen).method, first(seen).path]).toEqual(['GET', '/made-up-prefix/x.bin'])
  })

  it('list reads every page under {prefix}/{folder}/ and gives paths relative to the root', async () => {
    const { seen, requestHandler } = handlerAnswering(
      xml('list-objects-v2-page-1.xml'),
      xml('list-objects-v2-page-2.xml'),
    )
    const listed = await s3Storage(testContext(), { requestHandler }).list('folder')
    expect(listed).toEqual(['folder/a.txt', 'folder/deep/b.png', 'folder/c.json'])
    expect(seen.map((r) => [r.query['list-type'], r.query.prefix])).toEqual([
      ['2', 'made-up-prefix/folder/'],
      ['2', 'made-up-prefix/folder/'],
    ])
    expect(seen[1]?.query['continuation-token']).toBe('made-up-token-1')
  })

  it('list of an empty folder is no paths', async () => {
    const { requestHandler } = handlerAnswering(xml('list-objects-v2-empty.xml'))
    expect(await s3Storage(testContext(), { requestHandler }).list('nothing/')).toEqual([])
  })

  it('remove deletes exactly the named keys in one quiet DeleteObjects call', async () => {
    const { seen, requestHandler } = handlerAnswering(xml('delete-objects-quiet.xml'))
    await s3Storage(testContext(), { requestHandler }).remove(['a.txt', 'sub/b.txt'])
    const call = first(seen)
    expect([call.method, 'delete' in call.query]).toEqual(['POST', true])
    const body = new TextDecoder().decode(call.body)
    const keys = [...body.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => m[1])
    expect(keys).toEqual(['made-up-prefix/a.txt', 'made-up-prefix/sub/b.txt'])
    expect(body).toContain('<Quiet>true</Quiet>')
  })

  it('remove of no paths makes no call, and more than 1000 are sent in groups of 1000', async () => {
    const { seen, requestHandler } = recordingHandler(() => xml('delete-objects-quiet.xml'))
    const storage = s3Storage(testContext(), { requestHandler })
    await storage.remove([])
    expect(seen).toHaveLength(0)
    await storage.remove(Array.from({ length: 1001 }, (_v, i) => `f${i}.txt`))
    expect(seen).toHaveLength(2)
  })

  it('remove fails when S3 reports a key it could not delete', async () => {
    const { requestHandler } = handlerAnswering(xml('delete-objects-error.xml'))
    const call = s3Storage(testContext(), { requestHandler }).remove(['a.txt', 'b.txt'])
    await expect(call).rejects.toMatchObject({ error: { kind: 'bad_key' } })
  })
})

describe('S3 storage: root, keys and settings [SPEC 6, 6.5]', () => {
  const savedEnv = { ...process.env }
  afterEach(() => {
    process.env = { ...savedEnv }
  })

  it('refuses a path that would leave the root without making a call', async () => {
    const { seen, requestHandler } = recordingHandler(() => ok())
    const storage = s3Storage(testContext(), { requestHandler })
    await expect(storage.write('../x.txt', text('x'), 'text/plain')).rejects.toThrow(/refused/)
    await expect(storage.list('/')).rejects.toThrow(/refused/)
    await expect(storage.remove(['ok.txt', 'a/../../x.txt'])).rejects.toThrow(/refused/)
    expect(seen).toHaveLength(0)
  })

  it('uses no prefix when none is set, and trims slashes from a set one', async () => {
    const { seen, requestHandler } = recordingHandler(() => ok())
    await s3Storage(testContext(''), { requestHandler }).exists('a.txt')
    await s3Storage(testContext('/p/q/'), { requestHandler }).exists('a.txt')
    expect(seen.map((r) => r.path)).toEqual(['/a.txt', '/p/q/a.txt'])
  })

  it('signs with the keys from ctx.secret, never from the environment', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'environment-id-must-not-be-used'
    process.env.AWS_SECRET_ACCESS_KEY = 'environment-secret-must-not-be-used'
    const { seen, requestHandler } = recordingHandler(() => ok())
    await s3Storage(testContext(), { requestHandler }).exists('a.txt')
    const auth = first(seen).headers.authorization ?? ''
    expect(auth).toContain(`Credential=${TEST_KEY_ID}/`)
    expect(JSON.stringify(first(seen).headers)).not.toContain(TEST_SECRET)
  })

  it('sends each call once: a failed call is not repeated', async () => {
    const { seen, requestHandler } = recordingHandler(() => xml('error-internal.xml', 500))
    await expect(s3Storage(testContext(), { requestHandler }).read('a.txt')).rejects.toMatchObject({
      error: { kind: 'other' },
    })
    expect(seen).toHaveLength(1)
  })

  it('throws a ProviderFailure of kind other when no S3 settings are saved [1.12]', () => {
    const ctx = testContext()
    const unset = { ...ctx, settings: () => ({ storage: { s3: null, dropbox: null } }) }
    expect(() => s3Storage(unset as typeof ctx)).toThrow(
      expect.objectContaining({ error: { kind: 'other', detail: 'S3 storage is not set up' } }),
    )
  })

  it('is the storage adapter of the s3 provider folder', () => {
    expect(typeof adapters.storage).toBe('function')
  })
})
