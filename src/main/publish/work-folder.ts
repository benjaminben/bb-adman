// The work folder of a publish (spec/phases/phase-09.md "Publishing", A-227):
// {userData}/publish-work/{jobId}/, where the export writes before the upload. publish-work is
// checked with lstat (a link or a non-folder refuses work_folder_unsafe), and its real path must
// then be {real userData}/publish-work, so a swap after the lstat refuses too; it is used at that
// real path, so open-inside.ts can check the root it is given. Both folders are made with mode
// 0o700 (this user only). The job folder is made new. Its removal never fails the publish: an
// error there is dropped, so it cannot change the job's end or carry the path anywhere. At a
// publish start, leftover direct children whose names are ULIDs and that are real folders (not
// links) are removed, except the folders of publishes still under way in this process.
// P8-16: the video export uses the same rules under its own base, export-work (export/video/
// work-dir.ts), and sweepWorkFolders removes its leftovers at app start.
import fs from 'node:fs/promises'
import path from 'node:path'
import { errnoCode, LocalFailure } from '@/main/jobs/local-failure'
import { isUlid } from '@/shared/publish/paths'

export const WORK_FOLDER = 'publish-work'

export type WorkFolder = { path: string; remove(): Promise<void> }

const inUse = new Set<string>()

const unsafe = () => new LocalFailure('work_folder_unsafe')
const MODE = 0o700

async function baseFolder(userDataDir: string, name: string): Promise<string> {
  const base = path.join(userDataDir, name)
  let stats = await fs.lstat(base).catch((e: unknown) => {
    if (errnoCode(e) !== 'ENOENT') throw unsafe()
    return null
  })
  if (!stats) {
    await fs.mkdir(base, { recursive: true, mode: MODE }).catch(() => {
      throw unsafe()
    })
    stats = await fs.lstat(base).catch(() => null)
  }
  if (!stats?.isDirectory()) throw unsafe()
  const [real, expected] = await Promise.all([
    fs.realpath(base),
    fs.realpath(userDataDir).then((dir) => path.join(dir, name)),
  ]).catch(() => {
    throw unsafe()
  })
  if (real !== expected) throw unsafe()
  return real
}

async function removeLeftovers(base: string): Promise<void> {
  const names = await fs.readdir(base).catch(() => [])
  for (const name of names) {
    const folder = path.join(base, name)
    if (!isUlid(name) || inUse.has(folder)) continue
    const stats = await fs.lstat(folder).catch(() => null)
    if (stats?.isDirectory()) await fs.rm(folder, { recursive: true, force: true })
  }
}

export async function makeWorkFolder(
  userDataDir: string,
  jobId: string,
  name: string = WORK_FOLDER,
): Promise<WorkFolder> {
  if (!isUlid(jobId)) throw unsafe()
  const base = await baseFolder(userDataDir, name)
  await removeLeftovers(base)
  const folder = path.join(base, jobId)
  await fs.mkdir(folder, { mode: MODE }).catch(() => {
    throw unsafe()
  })
  inUse.add(folder)
  return {
    path: folder,
    async remove() {
      inUse.delete(folder)
      await fs.rm(folder, { recursive: true, force: true }).catch(() => undefined)
    },
  }
}

// At app start: the leftovers of the base `name`, when it is a real folder at its real path.
// Nothing is made, and nothing fails.
export async function sweepWorkFolders(userDataDir: string, name: string): Promise<void> {
  const stats = await fs.lstat(path.join(userDataDir, name)).catch(() => null)
  if (!stats?.isDirectory()) return
  const base = await baseFolder(userDataDir, name).catch(() => null)
  if (base) await removeLeftovers(base)
}
