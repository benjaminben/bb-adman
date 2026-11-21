import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetList } from '../../../src/main/queries/asset'
import { createProjectRegistry } from '../../../src/main/db/project-registry'
import {
  closeProjectFile,
  createProjectFile,
  type ProjectHandle,
} from '../../../src/main/db/project-file'
import { insertTestAsset } from './asset-rows'

let root: string
let project: ProjectHandle
let list: ReturnType<typeof assetList>
const user = { actor: 'user' as const }
const A = '01JD0000000000000000000001'
const B = '01JD0000000000000000000002'
const C = '01JD0000000000000000000003'

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-list-'))
  project = createProjectFile({
    filePath: path.join(root, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: '2026-11-20T10:00:00.000Z',
  })
  const projects = createProjectRegistry()
  projects.add(project)
  list = assetList({ projects })
  project.db
    .prepare("INSERT INTO subject (id, name, created_at) VALUES ('bottle', 'Bottle', 'x')")
    .run()
  fs.writeFileSync(path.join(root, 'a.png'), 'x')
  insertTestAsset(project.db, { id: A, relPath: 'a.png', absPath: '/none/a.png' })
  insertTestAsset(project.db, {
    id: B,
    relPath: 'b.ttf',
    absPath: '/none/b.ttf',
    kind: 'font',
    subjectId: 'bottle',
  })
  insertTestAsset(project.db, {
    id: C,
    relPath: 'c.png',
    absPath: '/n/c.png',
    library: 'reference',
  })
})
afterEach(() => {
  closeProjectFile(project)
  fs.rmSync(root, { recursive: true, force: true })
})

type Listed = Array<{ id: string; missing: boolean; absPath: string }>

describe('asset.list [SPEC 4.3]', () => {
  it('lists every asset as a wire row with missing set from the path resolver', async () => {
    const rows = (await list({ projectId: project.projectId }, user)) as Listed
    expect(rows.map((r) => [r.id, r.missing])).toEqual([
      [A, false],
      [B, true],
      [C, true],
    ])
    expect(rows[0]).toMatchObject({ library: 'asset', kind: 'image', subjectId: null })
  })

  it('filters by library, kind and subject', async () => {
    const ids = async (filter: object) =>
      ((await list({ projectId: project.projectId, ...filter }, user)) as Listed).map((r) => r.id)
    expect(await ids({ library: 'reference' })).toEqual([C])
    expect(await ids({ kind: 'font' })).toEqual([B])
    expect(await ids({ subjectId: 'bottle' })).toEqual([B])
    expect(await ids({ library: 'asset', kind: 'image' })).toEqual([A])
  })

  it('refuses a subject the project does not hold with NOT_FOUND', async () => {
    await expect(
      list({ projectId: project.projectId, subjectId: 'cup' }, user),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('refuses a project that is not open, and a bad filter, as SPEC 4.1 says', async () => {
    await expect(list({ projectId: 'nope' }, user)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { reason: 'project_not_open' },
    })
    await expect(list({ projectId: project.projectId, kind: 'gif' }, user)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })
})
