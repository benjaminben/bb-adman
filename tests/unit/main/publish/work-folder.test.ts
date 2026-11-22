// P9-10 (spec/phases/phase-09.md "Publishing", work folder, A-227): {userData}/publish-work is
// checked with lstat, each job gets a new folder, and leftover job folders (ULID names, real
// folders) are removed at a publish start. A link or a file of the same name is left alone.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalFailure } from '@/main/jobs/local-failure'
import { makeWorkFolder, WORK_FOLDER } from '@/main/publish/work-folder'

const JOB = '01JD00000000000000000000JB'
const OLD = '01JD00000000000000000000DD'
const FILE = `01JD${'0'.repeat(20)}FF`
const OTHER = '01JD00000000000000000000TT'

let userData: string
let base: string

beforeEach(async () => {
  userData = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'adman-work-')), 'userData')
  base = path.join(userData, WORK_FOLDER)
})
afterEach(async () => {
  await fs.rm(path.dirname(userData), { recursive: true, force: true })
})

const failure = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e,
  )

describe('makeWorkFolder [P9-10, A-227]', () => {
  it('makes {userData}/publish-work/{jobId} new, at its real path, and removes it', async () => {
    const work = await makeWorkFolder(userData, JOB)
    expect(work.path).toBe(path.join(await fs.realpath(base), JOB))
    expect((await fs.lstat(work.path)).isDirectory()).toBe(true)
    expect(await fs.readdir(work.path)).toEqual([])
    await fs.writeFile(path.join(work.path, 'a.png'), 'x')
    await work.remove()
    await expect(fs.lstat(work.path)).rejects.toThrow()
    expect(await fs.readdir(base)).toEqual([])
  })

  it('removes leftover ULID folders, and leaves a link, a file and other names alone', async () => {
    const outside = path.join(path.dirname(userData), 'outside')
    await fs.mkdir(path.join(outside, 'keep'), { recursive: true })
    await fs.mkdir(path.join(base, OLD, 'exports'), { recursive: true })
    await fs.writeFile(path.join(base, OLD, 'exports', 'a.png'), 'left over')
    await fs.symlink(outside, path.join(base, OTHER))
    await fs.writeFile(path.join(base, FILE), 'a file')
    await fs.mkdir(path.join(base, 'not-a-job'))
    const work = await makeWorkFolder(userData, JOB)
    expect((await fs.readdir(base)).sort()).toEqual([FILE, JOB, OTHER, 'not-a-job'].sort())
    expect(await fs.readdir(path.join(outside))).toEqual(['keep'])
    await work.remove()
  })

  it('leaves the folder of a publish still under way alone', async () => {
    const first = await makeWorkFolder(userData, OLD)
    const second = await makeWorkFolder(userData, JOB)
    expect((await fs.readdir(base)).sort()).toEqual([JOB, OLD].sort())
    await first.remove()
    await second.remove()
  })

  it.each([
    ['a link', (target: string) => fs.symlink(target, base)],
    ['a file', () => fs.writeFile(base, 'not a folder')],
  ])('refuses work_folder_unsafe when publish-work is %s', async (_name, make) => {
    const target = path.join(path.dirname(userData), 'elsewhere')
    await fs.mkdir(target, { recursive: true })
    await fs.mkdir(userData, { recursive: true })
    await make(target)
    const error = await failure(makeWorkFolder(userData, JOB))
    expect(error).toBeInstanceOf(LocalFailure)
    expect(error).toMatchObject({ reason: 'work_folder_unsafe' })
    expect(await fs.readdir(target)).toEqual([])
  })

  it('refuses a job ID that is not a ULID', async () => {
    const error = await failure(makeWorkFolder(userData, '../escape'))
    expect(error).toMatchObject({ reason: 'work_folder_unsafe' })
  })
})
