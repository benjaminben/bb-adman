// Two projects whose campaigns share one campaign ID (a project file copied, given a new
// project ID): createLink and endLink on one never reach the other's kept password, link on
// the service or picture folder (spec/approvals.md "Security", "Kept passwords", "Pictures").
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { ulid } from 'ulid'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readLink } from '@/main/approvals/local-store'
import { TEST_PICTURES_FOLDER } from '@/main/approvals/test-picture-store'
import { picturePath } from '@/shared/approvals/picture-paths'
import { data } from '../core-fixture'
import { makeLinkFixture, setUp, type LinkFixture } from './link-fixture'

const PASSWORD_A = 'project-a-password-0001'
const PASSWORD_B = 'project-b-password-0002'
let lf: LinkFixture
let projectB = ''

beforeEach(async () => {
  lf = await makeLinkFixture()
  const { f } = lf
  const fileA = f.core.projects.requireOpen(lf.projectId).filePath
  data(await f.user('project.close', { projectId: lf.projectId }))
  const fileB = path.join(f.projectsDir, 'Links copy.adman')
  fs.copyFileSync(fileA, fileB)
  projectB = ulid()
  const db = new Database(fileB)
  db.prepare("UPDATE project_meta SET value = ? WHERE key = 'project_id'").run(projectB)
  db.close()
  data(await f.user('project.open', { filePath: fileA }))
  expect(
    data<{ projectId: string }>(await f.user('project.open', { filePath: fileB })),
  ).toMatchObject({ projectId: projectB })
  await setUp(lf)
})
afterEach(() => lf.close())

const of = (projectId: string) => ({ projectId, campaignId: lf.c1 })
const kept = (projectId: string) => lf.f.core.deps.approvals.passwords.read(projectId, lf.c1)
const dbOf = (projectId: string) => lf.f.core.projects.requireOpen(projectId).db
const onDisk = (rel: string) => fs.existsSync(path.join(lf.f.userData, TEST_PICTURES_FOLDER, rel))

describe('two projects with the same campaign ID', () => {
  it('keep their own links, passwords and pictures through createLink and endLink', async () => {
    const a = data<{ slug: string }>(
      await lf.f.user('approvals.createLink', { ...of(lf.projectId), password: PASSWORD_A }),
    )
    const b = data<{ slug: string }>(
      await lf.f.user('approvals.createLink', { ...of(projectB), password: PASSWORD_B }),
    )
    expect(b.slug).not.toBe(a.slug)
    expect([kept(lf.projectId), kept(projectB)]).toEqual([PASSWORD_A, PASSWORD_B])
    expect(lf.stand.links.get(`${lf.projectId}/${lf.c1}`)?.password).toBe(PASSWORD_A)

    const store = lf.f.core.deps.approvals.pictures()
    const picA = picturePath(lf.projectId, lf.c1, 'k3f9q2', 1)
    const picB = picturePath(projectB, lf.c1, 'k3f9q2', 1)
    for (const p of [picA, picB]) await store.put(p, new Uint8Array([137, 80, 78, 71]))

    data(await lf.f.user('approvals.endLink', of(projectB)))
    expect(onDisk(picB)).toBe(false)
    expect(onDisk(picA)).toBe(true)
    expect(lf.stand.links.has(`${projectB}/${lf.c1}`)).toBe(false)
    expect(lf.stand.links.get(`${lf.projectId}/${lf.c1}`)?.slug).toBe(a.slug)
    expect([kept(lf.projectId), kept(projectB)]).toEqual([PASSWORD_A, null])
    const log = lf.f.core.deps.log
    expect(readLink(dbOf(lf.projectId), lf.c1, log)).toMatchObject({ state: 'live' })
    expect(readLink(dbOf(projectB), lf.c1, log)).toMatchObject({ state: 'ended' })
    const deletes = lf.stand.seen.filter((s) => s.route === 'deleteLink').map((s) => s.path)
    expect(deletes).toEqual([`/api/v1/links/${projectB}/${lf.c1}`])
  })
})
