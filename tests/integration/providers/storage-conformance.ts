// SPEC 6.5 [1.8]: one set of cases written against StorageProvider. Every implementation runs
// them: the local one in CI (local-storage.test.ts), S3 by hand (tests/live/s3.live.test.ts).
// Each run works in its own folder and removes what it wrote.
import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { StorageProvider } from '../../../src/main/providers/types'

const text = (value: string) => new TextEncoder().encode(value)

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(text(chunk))
      controller.close()
    },
  })
}

const BAD_PATHS = ['../outside.txt', 'a/../../outside.txt', '/absolute.txt']

export function describeStorageConformance(
  label: string,
  setup: () => Promise<StorageProvider> | StorageProvider,
  options: { timeout?: number; skip?: boolean } = {},
): void {
  const suite = describe.skipIf(options.skip ?? false)
  suite(`StorageProvider conformance: ${label} [SPEC 6.5]`, { timeout: options.timeout }, () => {
    let storage: StorageProvider
    const base = `conformance-${randomUUID()}`

    beforeAll(async () => {
      storage = await setup()
    })

    afterAll(async () => {
      if (!storage) return
      const left = await storage.list(base)
      if (left.length > 0) await storage.remove(left)
    })

    it('write then exists: the written path exists and an unwritten one does not', async () => {
      await storage.write(`${base}/exists/a.txt`, text('a'), 'text/plain')
      expect(await storage.exists(`${base}/exists/a.txt`)).toBe(true)
      expect(await storage.exists(`${base}/exists/never.txt`)).toBe(false)
    })

    it('write then read gives the same bytes, for bytes and for a stream', async () => {
      const bytes = new Uint8Array([0, 1, 2, 250, 255])
      await storage.write(`${base}/read/bytes.bin`, bytes, 'application/octet-stream')
      expect(await storage.read(`${base}/read/bytes.bin`)).toEqual(bytes)
      await storage.write(`${base}/read/stream.txt`, streamOf('hello ', 'world'), 'text/plain')
      expect(await storage.read(`${base}/read/stream.txt`)).toEqual(text('hello world'))
    })

    it('write over an existing path replaces its bytes', async () => {
      await storage.write(`${base}/replace/a.txt`, text('first'), 'text/plain')
      await storage.write(`${base}/replace/a.txt`, text('second'), 'text/plain')
      expect(await storage.read(`${base}/replace/a.txt`)).toEqual(text('second'))
    })

    it('list shows what was written, every level down, and nothing outside the prefix', async () => {
      const inside = [`${base}/list/in/a.txt`, `${base}/list/in/deep/er/b.txt`]
      const outside = [`${base}/list/inside.txt`, `${base}/list/out/c.txt`, `${base}/top.txt`]
      for (const path of [...inside, ...outside])
        await storage.write(path, text(path), 'text/plain')
      expect((await storage.list(`${base}/list/in`)).sort()).toEqual(inside)
      expect((await storage.list(`${base}/list/in/`)).sort()).toEqual(inside)
      expect(await storage.list(`${base}/list/nothing-here`)).toEqual([])
    })

    it('list returns files only, an empty prefix lists everything, and each path can be read [SPEC 6.5 1.13, H6]', async () => {
      const written = [
        `${base}/whole/a.txt`,
        `${base}/whole/sub/deeper/b.txt`,
        `${base}/whole/ab.txt`,
      ]
      for (const path of written) await storage.write(path, text(path), 'text/plain')
      expect(await storage.list('')).toEqual(expect.arrayContaining(written))
      const listed = await storage.list(`${base}/whole`)
      expect(listed.sort()).toEqual([...written].sort())
      expect(listed.filter((path) => path.endsWith('/'))).toEqual([])
      for (const path of listed) expect(await storage.read(path)).toEqual(text(path))
      expect(await storage.list(`${base}/whole/a`)).toEqual([])
    })

    it('remove removes only the named paths, and a missing path is not an error', async () => {
      const kept = `${base}/remove/kept.txt`
      const gone = [`${base}/remove/a.txt`, `${base}/remove/sub/b.txt`]
      for (const path of [kept, ...gone]) await storage.write(path, text(path), 'text/plain')
      await storage.remove([...gone, `${base}/remove/never-written.txt`])
      expect(await storage.list(`${base}/remove`)).toEqual([kept])
      await storage.remove([])
      expect(await storage.exists(kept)).toBe(true)
    })

    it.each(BAD_PATHS)('refuses the path %s in every call', async (bad) => {
      await expect(storage.write(bad, text('x'), 'text/plain')).rejects.toThrow(/refused/)
      await expect(storage.read(bad)).rejects.toThrow(/refused/)
      await expect(storage.exists(bad)).rejects.toThrow(/refused/)
      await expect(storage.list(bad)).rejects.toThrow(/refused/)
      await expect(storage.remove([`${base}/fine.txt`, bad])).rejects.toThrow(/refused/)
    })
  })
}
