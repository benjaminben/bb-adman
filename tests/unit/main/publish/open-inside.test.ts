// P9-8: a file to upload is read only when, at the moment it is opened, it is a regular file
// whose real path is inside the folder it was listed in. A refusal holds no path.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalFileRefused, openFileInside, openInside } from '@/main/publish/open-inside'

let base: string
let work: string

beforeEach(async () => {
  // The real path: a root reached through a link (as /var is on macOS) is refused (P9-10).
  base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'adman-open-inside-')))
  work = path.join(base, 'work')
  await fs.mkdir(path.join(work, 'exports'), { recursive: true })
  await fs.writeFile(path.join(base, 'outside.txt'), 'outside bytes')
})
afterEach(async () => {
  await fs.rm(base, { recursive: true, force: true })
})

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function refusal(stream: ReadableStream<Uint8Array>): Promise<unknown> {
  return readAll(stream).then(
    () => null,
    (e: unknown) => e,
  )
}

describe('openFileInside', () => {
  it('reads a regular file inside the folder, in full, across many chunks', async () => {
    const bytes = Buffer.alloc(300_000)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251
    await fs.writeFile(path.join(work, 'exports', 'a.png'), bytes)
    const read = await readAll(openFileInside(work, path.join(work, 'exports', 'a.png')))
    expect(read.equals(bytes)).toBe(true)
  })

  it('opens nothing until the stream is read, so the check is made at read time', async () => {
    const file = path.join(work, 'later.png')
    await fs.writeFile(file, 'good bytes')
    const stream = openFileInside(work, file)
    await fs.rm(file)
    await fs.symlink(path.join(base, 'outside.txt'), file)
    expect(await refusal(stream)).toBeInstanceOf(LocalFileRefused)
  })

  const cases: Array<[string, () => Promise<string>]> = [
    [
      'a link to a file outside',
      async () => {
        const link = path.join(work, 'link.png')
        await fs.symlink(path.join(base, 'outside.txt'), link)
        return link
      },
    ],
    [
      'a link to a file inside',
      async () => {
        await fs.writeFile(path.join(work, 'real.png'), 'x')
        const link = path.join(work, 'link.png')
        await fs.symlink(path.join(work, 'real.png'), link)
        return link
      },
    ],
    [
      'a file under a linked folder that leads outside',
      async () => {
        await fs.symlink(base, path.join(work, 'out'))
        return path.join(work, 'out', 'outside.txt')
      },
    ],
    ['a path that climbs out', async () => path.join(work, '..', 'outside.txt')],
    ['a path outside the folder', async () => path.join(base, 'outside.txt')],
    ['a folder', async () => path.join(work, 'exports')],
    ['a missing file', async () => path.join(work, 'missing.png')],
    ['the folder itself', async () => work],
  ]

  it.each(cases)('refuses %s, with no path in the error', async (_name, make) => {
    const file = await make()
    const error = await refusal(openFileInside(work, file))
    expect(error).toBeInstanceOf(LocalFileRefused)
    const text = `${(error as Error).message} ${JSON.stringify(error)}`
    expect(text).not.toContain(base)
    expect(text).not.toContain('outside')
  })
})

describe('openFileInside, P9-10 hardening', () => {
  it('refuses a hard link, a file with more than one name', async () => {
    const file = path.join(work, 'a.png')
    await fs.writeFile(file, 'shared bytes')
    await fs.link(file, path.join(base, 'second-name.png'))
    expect(await refusal(openFileInside(work, file))).toBeInstanceOf(LocalFileRefused)
  })

  it('refuses a root that is a link, even to a real folder', async () => {
    await fs.writeFile(path.join(work, 'a.png'), 'x')
    const linkedRoot = path.join(base, 'linked-work')
    await fs.symlink(work, linkedRoot)
    const stream = openFileInside(linkedRoot, path.join(linkedRoot, 'a.png'))
    expect(await refusal(stream)).toBeInstanceOf(LocalFileRefused)
  })

  it('refuses a root whose real path differs from it', async () => {
    await fs.mkdir(path.join(base, 'real', 'work'), { recursive: true })
    await fs.writeFile(path.join(base, 'real', 'work', 'a.png'), 'x')
    await fs.symlink(path.join(base, 'real'), path.join(base, 'via'))
    const root = path.join(base, 'via', 'work')
    expect(await refusal(openFileInside(root, path.join(root, 'a.png')))).toBeInstanceOf(
      LocalFileRefused,
    )
  })

  it('refuses a root that is a file', async () => {
    const file = path.join(work, 'a.png')
    await fs.writeFile(file, 'x')
    expect(await refusal(openFileInside(file, file))).toBeInstanceOf(LocalFileRefused)
  })
})

describe('openInside, one checked handle [P9-10]', () => {
  it('gives a handle to the checked file, whose bytes are read once', async () => {
    const file = path.join(work, 'a.ttf')
    await fs.writeFile(file, 'font bytes')
    const handle = await openInside(work, file)
    expect((await handle.readFile()).toString()).toBe('font bytes')
    await handle.close()
  })

  it('refuses as openFileInside does, with no path in the error', async () => {
    const file = path.join(work, 'a.ttf')
    await fs.writeFile(file, 'x')
    await fs.link(file, path.join(base, 'twin.ttf'))
    const error = await openInside(work, file).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(LocalFileRefused)
    expect(JSON.stringify(error) + String(error)).not.toContain(base)
    const missing = await openInside(work, path.join(work, 'gone.ttf')).catch((e: unknown) => e)
    expect(missing).toBeInstanceOf(LocalFileRefused)
  })
})
