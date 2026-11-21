import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fileForAssetUrl } from '../../../src/main/assets/asset-url'
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

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-url-'))
  project = createProjectFile({
    filePath: path.join(root, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects = createProjectRegistry()
  projects.add(project)
  fs.writeFileSync(path.join(root, 'a.png'), 'x')
  insertTestAsset(project.db, { id: ID, relPath: 'a.png', absPath: '/none/a.png' })
  insertTestAsset(project.db, { id: GONE, relPath: 'g.png', absPath: '/none/g.png' })
})
afterEach(() => {
  closeProjectFile(project)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('adman-asset:// address to file [SPEC 3.6 "Asset files", 8.2]', () => {
  it('gives the resolved file and stored type for an open project and a known asset', async () => {
    const url = `adman-asset://${project.projectId}/${ID}`
    expect(await fileForAssetUrl(url, projects)).toEqual({
      file: path.join(root, 'a.png'),
      mime: 'image/png',
    })
  })

  it('serves nothing for a project that is not open', async () => {
    expect(await fileForAssetUrl(`adman-asset://01JD9999999999999999999999/${ID}`, projects)).toBe(
      null,
    )
  })

  it('serves nothing for an asset the project does not hold, or whose file is missing', async () => {
    const base = `adman-asset://${project.projectId}`
    expect(await fileForAssetUrl(`${base}/01JD0000000000000000000009`, projects)).toBe(null)
    expect(await fileForAssetUrl(`${base}/${GONE}`, projects)).toBe(null)
  })

  it('serves nothing for any other shape of address', async () => {
    const base = `adman-asset://${project.projectId}`
    for (const url of [
      `https://${project.projectId}/${ID}`,
      `${base}/${ID}/more`,
      `${base}/../${ID}`,
      `${base}/${ID}?x=1`,
      `${base}/`,
      `adman-asset:///${ID}`,
      'not a url',
    ]) {
      expect(await fileForAssetUrl(url, projects)).toBe(null)
    }
  })
})

describe('adman-asset:// letter case [SPEC 3.2 ULIDs]', () => {
  it('serves the same file when the address is in lower case', async () => {
    const url = `adman-asset://${project.projectId}/${ID}`.toLowerCase()
    expect(await fileForAssetUrl(url, projects)).toMatchObject({ mime: 'image/png' })
  })
})

describe('adman-asset:// serves no text asset [SPEC 14, Slice A rulings point 2, A2-2]', () => {
  it('gives null for a text asset whose file is found', async () => {
    const TEXT = '01JD0000000000000000000003'
    fs.writeFileSync(path.join(root, 'notes.txt'), 'hello')
    insertTestAsset(project.db, {
      id: TEXT,
      relPath: 'notes.txt',
      absPath: '/none/notes.txt',
      kind: 'text',
      mime: 'text/plain',
    })
    expect(await fileForAssetUrl(`adman-asset://${project.projectId}/${TEXT}`, projects)).toBe(null)
  })
})
