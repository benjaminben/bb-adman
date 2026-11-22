// The work folder of a publish (spec/phases/phase-09.md "Publishing", A-227):
// {userData}/publish-work/{jobId}/, where the export writes before the upload. publish-work is
// checked with lstat (a link or a non-folder refuses work_folder_unsafe) and used at its real
// path, so open-inside.ts can check the root it is given. The job folder is made new. At a
// publish start, leftover direct children whose names are ULIDs and that are real folders (not
// links) are removed, except the folders of publishes still under way in this process.
import fs from 'node:fs/promises'
import path from 'node:path'
import { errnoCode, LocalFailure } from '@/main/jobs/local-failure'
import { isUlid } from '@/shared/publish/paths'

export const WORK_FOLDER = 'publish-work'

export type WorkFolder = { path: string; remove(): Promise<void> }

const inUse = new Set<string>()

const unsafe = () => new LocalFailure('work_folder_unsafe')

async function baseFolder(userDataDir: string): Promise<string> {
  const base = path.join(userDataDir, WORK_FOLDER)
  let stats = await fs.lstat(base).catch((e: unknown) => {
    if (errnoCode(e) !== 'ENOENT') throw unsafe()
    return null
  })
  if (!stats) {
    await fs.mkdir(base, { recursive: true }).catch(() => {
      throw unsafe()
    })
    stats = await fs.lstat(base).catch(() => null)
  }
  if (!stats?.isDirectory()) throw unsafe()
  return fs.realpath(base).catch(() => {
    throw unsafe()
  })
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

export async function makeWorkFolder(userDataDir: string, jobId: string): Promise<WorkFolder> {
  if (!isUlid(jobId)) throw unsafe()
  const base = await baseFolder(userDataDir)
  await removeLeftovers(base)
  const folder = path.join(base, jobId)
  await fs.mkdir(folder).catch(() => {
    throw unsafe()
  })
  inUse.add(folder)
  return {
    path: folder,
    async remove() {
      inUse.delete(folder)
      await fs.rm(folder, { recursive: true, force: true })
    },
  }
}
