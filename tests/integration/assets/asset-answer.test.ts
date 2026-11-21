import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { answerAssetRequest } from '../../../src/main/assets/asset-url'
import { createProjectRegistry, type ProjectRegistry } from '../../../src/main/db/project-registry'
import {
  closeProjectFile,
  createProjectFile,
  type ProjectHandle,
} from '../../../src/main/db/project-file'
import { insertTestAsset } from './asset-rows'

let root: string
let project: ProjectHandle
let projects: ProjectRegistry
const ID = '01JD0000000000000000000001'
const GONE = '01JD0000000000000000000002'
const TEXT = '01JD0000000000000000000003'
const VIDEO = '01JD0000000000000000000004'
const BYTES = 'picture bytes'

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-answer-'))
  project = createProjectFile({
    filePath: path.join(root, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects = createProjectRegistry()
  projects.add(project)
  fs.writeFileSync(path.join(root, 'a.webp'), BYTES)
  fs.writeFileSync(path.join(root, 'n.txt'), 'notes')
  fs.writeFileSync(path.join(root, 'v.mp4'), 'video bytes')
  insertTestAsset(project.db, {
    id: ID,
    relPath: 'a.webp',
    absPath: '/none/a.webp',
    mime: 'image/png',
  })
  insertTestAsset(project.db, { id: GONE, relPath: 'g.png', absPath: '/none/g.png' })
  insertTestAsset(project.db, {
    id: TEXT,
    relPath: 'n.txt',
    absPath: '/none/n.txt',
    kind: 'text',
    mime: 'text/plain',
  })
  insertTestAsset(project.db, {
    id: VIDEO,
    relPath: 'v.mp4',
    absPath: '/none/v.mp4',
    kind: 'video',
    mime: 'video/mp4',
  })
})
afterEach(() => {
  closeProjectFile(project)
  fs.rmSync(root, { recursive: true, force: true })
})

const url = (assetId: string) => `adman-asset://${project.projectId}/${assetId}`
const answer = (u: string, method = 'GET') => answerAssetRequest({ method, url: u }, projects)

async function expectNotFound(res: Response): Promise<void> {
  expect(res.status).toBe(404)
  expect(await res.text()).toBe('')
  expect(res.headers.get('content-type')).toBe(null)
}

describe('the adman-asset:// answer [SPEC 14, Slice A rulings point 2, A2-2]', () => {
  it('sends the file with the row type, nosniff and no-store', async () => {
    const res = await answer(url(ID))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(BYTES)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('sends a video asset with its own row type', async () => {
    const res = await answer(url(VIDEO))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('video/mp4')
  })

  it('answers only GET', async () => {
    for (const method of ['POST', 'PUT', 'HEAD', 'DELETE', 'OPTIONS']) {
      await expectNotFound(await answer(url(ID), method))
    }
  })

  it('gives 404 with an empty body for each failed check', async () => {
    for (const u of [
      `${url(ID)}?x=1`,
      `${url(ID)}#x`,
      `${url(ID)}/more`,
      `adman-asset://01JD9999999999999999999999/${ID}`,
      url('01JD0000000000000000000009'),
      url(GONE),
      url(TEXT),
      'not a url',
    ]) {
      await expectNotFound(await answer(u))
    }
  })

  it('gives 404 when the file goes between the check and the read', async () => {
    fs.rmSync(path.join(root, 'a.webp'))
    await expectNotFound(await answer(url(ID)))
  })

  it('puts no path or file name in any answer or header', async () => {
    for (const u of [url(ID), url(GONE), url(TEXT)]) {
      const res = await answer(u)
      const text = [...res.headers.entries()].flat().join('\n')
      for (const part of [root, 'a.webp', 'g.png', 'n.txt']) expect(text).not.toContain(part)
      if (res.status === 404) expect(await res.text()).toBe('')
    }
  })
})
