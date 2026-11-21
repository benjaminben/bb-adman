import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Protocol } from 'electron'
import { answerAssetRequest } from '@/main/assets/asset-url'
import { registerAssetProtocol } from '@/main/windows/asset-protocol'
import { createProjectRegistry, type ProjectRegistry } from '@/main/db/project-registry'
import { closeProjectFile, createProjectFile, type ProjectHandle } from '@/main/db/project-file'
import { insertTestAsset } from './asset-rows'

let root: string
let project: ProjectHandle
let projects: ProjectRegistry
const VIDEO = '01JD0000000000000000000004'
const GONE = '01JD0000000000000000000002'
const TEXT = '01JD0000000000000000000003'
const ODD = '01JD0000000000000000000005'
const BYTES = '0123456789abcdefghij'

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-range-'))
  project = createProjectFile({
    filePath: path.join(root, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects = createProjectRegistry()
  projects.add(project)
  fs.writeFileSync(path.join(root, 'v.mp4'), BYTES)
  fs.writeFileSync(path.join(root, 'n.txt'), 'notes')
  fs.writeFileSync(path.join(root, 'o.mp4'), BYTES)
  const video = { kind: 'video', mime: 'video/mp4' } as const
  insertTestAsset(project.db, { id: VIDEO, relPath: 'v.mp4', absPath: '/none/v.mp4', ...video })
  insertTestAsset(project.db, { id: GONE, relPath: 'g.mp4', absPath: '/none/g.mp4', ...video })
  insertTestAsset(project.db, {
    id: TEXT,
    relPath: 'n.txt',
    absPath: '/none/n.txt',
    kind: 'text',
    mime: 'text/plain',
  })
  // A row whose type file-types.ts does not list for its kind.
  insertTestAsset(project.db, {
    id: ODD,
    relPath: 'o.mp4',
    absPath: '/none/o.mp4',
    kind: 'video',
    mime: 'text/html',
  })
})
afterEach(() => {
  closeProjectFile(project)
  fs.rmSync(root, { recursive: true, force: true })
})

const url = (assetId: string) => `adman-asset://${project.projectId}/${assetId}`
const answer = (u: string, range?: string, method = 'GET') =>
  answerAssetRequest(
    { method, url: u, headers: new Headers(range === undefined ? {} : { Range: range }) },
    projects,
  )

function expectFixedHeaders(res: Response): void {
  expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  expect(res.headers.get('cache-control')).toBe('no-store')
}

async function expectNotFound(res: Response): Promise<void> {
  expect(res.status).toBe(404)
  expect(await res.text()).toBe('')
  expect(res.headers.get('content-type')).toBe(null)
  expect(res.headers.get('content-range')).toBe(null)
  expectFixedHeaders(res)
}

describe('byte ranges on adman-asset:// [P7-6]', () => {
  it('answers one range with 206 and exactly the bytes asked for', async () => {
    const res = await answer(url(VIDEO), 'bytes=2-5')
    expect(res.status).toBe(206)
    expect(await res.text()).toBe('2345')
    expect(res.headers.get('content-range')).toBe(`bytes 2-5/${BYTES.length}`)
    expect(res.headers.get('content-length')).toBe('4')
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    expect(res.headers.get('content-type')).toBe('video/mp4')
    expectFixedHeaders(res)
  })

  it('answers an open range, a suffix and an end past the file within the file', async () => {
    const cases: Array<[string, string, string]> = [
      ['bytes=15-', 'fghij', 'bytes 15-19/20'],
      ['bytes=-3', 'hij', 'bytes 17-19/20'],
      ['bytes=18-500', 'ij', 'bytes 18-19/20'],
      ['bytes=0-0', '0', 'bytes 0-0/20'],
    ]
    for (const [range, body, contentRange] of cases) {
      const res = await answer(url(VIDEO), range)
      expect(res.status).toBe(206)
      expect(await res.text()).toBe(body)
      expect(res.headers.get('content-range')).toBe(contentRange)
      expect(res.headers.get('content-length')).toBe(String(body.length))
    }
  })

  it('answers no range, or a range it does not read, with 200 and the whole file', async () => {
    for (const range of [undefined, 'bytes=5-2', 'bytes=0-1,4-5', 'bytes=a-b', 'items=0-1']) {
      const res = await answer(url(VIDEO), range)
      expect(res.status).toBe(200)
      expect(await res.text()).toBe(BYTES)
      expect(res.headers.get('content-length')).toBe(String(BYTES.length))
      expect(res.headers.get('accept-ranges')).toBe('bytes')
      expect(res.headers.get('content-range')).toBe(null)
      expect(res.headers.get('content-type')).toBe('video/mp4')
      expectFixedHeaders(res)
    }
  })

  it('answers a range past the file with 416, the size and an empty body', async () => {
    for (const range of ['bytes=20-', 'bytes=500-600', 'bytes=-0']) {
      const res = await answer(url(VIDEO), range)
      expect(res.status).toBe(416)
      expect(await res.text()).toBe('')
      expect(res.headers.get('content-range')).toBe(`bytes */${BYTES.length}`)
      expect(res.headers.get('content-type')).toBe(null)
      expectFixedHeaders(res)
    }
  })

  it('sends an empty file whole and refuses any range of it', async () => {
    fs.writeFileSync(path.join(root, 'v.mp4'), '')
    const whole = await answer(url(VIDEO))
    expect(whole.status).toBe(200)
    expect(await whole.text()).toBe('')
    expect(whole.headers.get('content-length')).toBe('0')
    const ranged = await answer(url(VIDEO), 'bytes=0-')
    expect(ranged.status).toBe(416)
    expect(ranged.headers.get('content-range')).toBe('bytes */0')
  })

  it('measures the file it opened, not its name', async () => {
    fs.writeFileSync(path.join(root, 'v.mp4'), 'short')
    const res = await answer(url(VIDEO), 'bytes=0-100')
    expect(res.status).toBe(206)
    expect(await res.text()).toBe('short')
    expect(res.headers.get('content-range')).toBe('bytes 0-4/5')
  })

  it('still gives 404 for every failed check when a range is sent', async () => {
    for (const u of [
      `${url(VIDEO)}?x=1`,
      `${url(VIDEO)}#x`,
      `${url(VIDEO)}/more`,
      `${url(VIDEO)}/../${VIDEO}`,
      `adman-asset://${project.projectId}/..%2F${VIDEO}`,
      `adman-asset://01JD9999999999999999999999/${VIDEO}`,
      url('01JD0000000000000000000009'),
      url(GONE),
      url(TEXT),
      url(ODD),
      'not a url',
    ]) {
      await expectNotFound(await answer(u, 'bytes=0-3'))
    }
  })

  it('answers only GET, with or without a range', async () => {
    for (const method of ['POST', 'PUT', 'HEAD', 'DELETE', 'OPTIONS']) {
      await expectNotFound(await answer(url(VIDEO), 'bytes=0-3', method))
    }
  })

  it('gets the Range header through the Electron handler', async () => {
    const handle = vi.fn()
    registerAssetProtocol({ handle } as unknown as Protocol, projects)
    const handler = handle.mock.calls[0]?.[1] as (r: Request) => Promise<Response>
    const res = await handler(
      new Request(url(VIDEO).replace('adman-asset:', 'https:'), {
        headers: { Range: 'bytes=0-1' },
      }),
    )
    expect(res.status).toBe(404)
    const request = { method: 'GET', url: url(VIDEO), headers: new Headers({ Range: 'bytes=0-1' }) }
    const ranged = await handler(request as unknown as Request)
    expect(ranged.status).toBe(206)
    expect(await ranged.text()).toBe('01')
  })

  it('takes the type from the row, never from the request', async () => {
    const res = await answerAssetRequest(
      {
        method: 'GET',
        url: url(VIDEO),
        headers: new Headers({ Range: 'bytes=0-1', Accept: 'text/html', 'Content-Type': 'x/y' }),
      },
      projects,
    )
    expect(res.headers.get('content-type')).toBe('video/mp4')
  })

  it('puts no path or file name in any answer or header', async () => {
    for (const [u, range] of [
      [url(VIDEO), 'bytes=0-3'],
      [url(VIDEO), 'bytes=90-'],
      [url(VIDEO), 'bytes=3-1'],
      [url(GONE), 'bytes=0-3'],
      [url(TEXT), 'bytes=0-3'],
    ] as const) {
      const res = await answer(u, range)
      const text = [...res.headers.entries()].flat().join('\n')
      for (const part of [root, 'v.mp4', 'g.mp4', 'n.txt']) expect(text).not.toContain(part)
      if (res.status !== 200 && res.status !== 206) expect(await res.text()).toBe('')
    }
  })
})
