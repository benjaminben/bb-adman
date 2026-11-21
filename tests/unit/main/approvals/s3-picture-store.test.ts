// AP-7 (spec/approvals.md "Pictures"): the S3 picture store over a stand-in StorageProvider.
// Every call stays inside one campaign's folder; a bad path is refused before the key guard and
// before any storage call; without both S3 keys every call is NEEDS_KEY and nothing is called.
import { describe, it, expect } from 'vitest'
import { s3PictureStore, type S3PictureStoreDeps } from '@/main/approvals/s3-picture-store'
import { listProviders } from '@/main/providers/registry'
import { REFUSED_PATH } from '@/main/providers/storage-paths'
import type { StorageProvider } from '@/main/providers/types'
import { AppError } from '@/shared/schemas/result'

const P = '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE'
const FOLDER = `adman-approvals/${P}/spring-sale-abc234/`
const OTHER = `adman-approvals/${P}/autumn-sale-abc234/`
const FILE = `${FOLDER}k3f9q2-3.png`
const NOW = new Date('2026-11-21T10:00:00.000Z')
const KEYS = {
  's3.accessKeyId': 'test-id-not-a-key',
  's3.secretAccessKey': 'test-secret-not-a-key',
}

type Call = [string, ...unknown[]]

function standIn(listed: string[] = [], signs = true) {
  const calls: Call[] = []
  const storage: StorageProvider = {
    exists: async (path) => (calls.push(['exists', path]), false),
    read: async (path) => (calls.push(['read', path]), new Uint8Array()),
    write: async (path, data, type) => void calls.push(['write', path, data, type]),
    list: async (prefix) => (calls.push(['list', prefix]), listed),
    remove: async (paths) => void calls.push(['remove', paths]),
  }
  if (signs) {
    storage.signedReadUrl = async (path, seconds) => {
      calls.push(['sign', path, seconds])
      return `https://made-up-bucket.s3.eu-west-1.amazonaws.com/${path}?X-Amz-Signature=abc`
    }
  }
  return { calls, storage }
}

function storeWith(saved: Record<string, string>, storage: StorageProvider) {
  const deps = {
    providers: listProviders({}),
    secrets: { get: (name: string) => saved[name] },
    settings: { get: () => ({}) },
    now: () => NOW,
  } as unknown as S3PictureStoreDeps
  return s3PictureStore(deps, { storage: () => storage })
}

describe('S3 picture store: calls inside the folder [spec/approvals.md "Pictures"]', () => {
  it('puts a PNG at its path', async () => {
    const { calls, storage } = standIn()
    const png = new Uint8Array([137, 80, 78, 71])
    await storeWith(KEYS, storage).put(FILE, png)
    expect(calls).toEqual([['write', FILE, png, 'image/png']])
  })

  it('signs a file and gives its expiry from now', async () => {
    const { calls, storage } = standIn()
    const signed = await storeWith(KEYS, storage).signedUrl(FILE, 604_800)
    expect(calls).toEqual([['sign', FILE, 604_800]])
    expect(signed.expiresAt).toBe('2026-11-28T10:00:00.000Z')
    expect(signed.url.startsWith('https://made-up-bucket.s3.eu-west-1.amazonaws.com/')).toBe(true)
  })

  it('lists the folder and gives back only its own picture files', async () => {
    const listed = [FILE, `${FOLDER}sub/k3f9q2-1.png`, `${FOLDER}notes.txt`, `${OTHER}k3f9q2-1.png`]
    const { calls, storage } = standIn(listed)
    expect(await storeWith(KEYS, storage).list(FOLDER)).toEqual([FILE])
    expect(calls).toEqual([['list', FOLDER]])
  })

  it('removes picture files of one folder', async () => {
    const { calls, storage } = standIn()
    const two = [FILE, `${FOLDER}aaaaaa-1.png`]
    await storeWith(KEYS, storage).remove(two)
    expect(calls).toEqual([['remove', two]])
  })

  it('removes nothing and calls nothing for an empty list', async () => {
    const { calls, storage } = standIn()
    await storeWith(KEYS, storage).remove([])
    expect(calls).toEqual([])
  })
})

const BAD_FILES = [
  '',
  'a.png',
  FOLDER,
  `${FOLDER}../x-abc234/k3f9q2-1.png`,
  `${FOLDER}sub/k3f9q2-1.png`,
  `${FOLDER}notes.txt`,
  `adman-approvals/${P}/k3f9q2-1.png`,
  `other/${P}/spring-sale-abc234/k3f9q2-1.png`,
]

describe('S3 picture store: nothing outside the folder [spec/approvals.md "Pictures"]', () => {
  it.each(BAD_FILES)('refuses to put, sign or remove %j and calls nothing', async (path) => {
    const { calls, storage } = standIn()
    const store = storeWith(KEYS, storage)
    const refused = new Error(REFUSED_PATH)
    await expect(store.put(path, new Uint8Array([1]))).rejects.toThrow(refused)
    await expect(store.signedUrl(path, 60)).rejects.toThrow(refused)
    await expect(store.remove([FILE, path])).rejects.toThrow(refused)
    expect(calls).toEqual([])
  })

  it.each(['', 'adman-approvals/', `adman-approvals/${P}/`, `${FOLDER}sub/`, FILE])(
    'refuses to list %j and calls nothing',
    async (folder) => {
      const { calls, storage } = standIn()
      await expect(storeWith(KEYS, storage).list(folder)).rejects.toThrow(new Error(REFUSED_PATH))
      expect(calls).toEqual([])
    },
  )

  it('refuses a removal that spans two campaign folders and calls nothing', async () => {
    const { calls, storage } = standIn()
    const store = storeWith(KEYS, storage)
    await expect(store.remove([FILE, `${OTHER}k3f9q2-1.png`])).rejects.toThrow(
      new Error(REFUSED_PATH),
    )
    expect(calls).toEqual([])
  })

  it('refuses a lifetime over 7 days before calling the storage', async () => {
    const { calls, storage } = standIn()
    await expect(storeWith(KEYS, storage).signedUrl(FILE, 604_801)).rejects.toThrow(
      'Signed address lifetime refused',
    )
    expect(calls).toEqual([])
  })
})

describe('S3 picture store: the key guard [spec/approvals.md "Pictures"]', () => {
  it.each([
    ['no keys', {}],
    ['no secret key', { 's3.accessKeyId': 'test-id-not-a-key' }],
    ['no key ID', { 's3.secretAccessKey': 'test-secret-not-a-key' }],
  ])('with %s every call is NEEDS_KEY and calls nothing', async (_case, saved) => {
    const { calls, storage } = standIn()
    const store = storeWith(saved, storage)
    const needsKey = { code: 'NEEDS_KEY', details: { provider: 's3' } }
    for (const call of [
      () => store.put(FILE, new Uint8Array([1])),
      () => store.signedUrl(FILE, 60),
      () => store.list(FOLDER),
      () => store.remove([FILE]),
    ]) {
      const error: unknown = await call().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(AppError)
      expect(error).toMatchObject(needsKey)
    }
    expect(calls).toEqual([])
  })

  it('fails when the storage cannot sign, and sends nothing', async () => {
    const { calls, storage } = standIn([], false)
    await expect(storeWith(KEYS, storage).signedUrl(FILE, 60)).rejects.toThrow()
    expect(calls).toEqual([])
  })
})
