// The output folder check (spec/phases/phase-08.md "The output folder (security)"). Security
// class: the path comes from the window. It must be absolute, at most 4,096 characters, with
// no NUL; its real path must be a folder, not the app data folder or inside it, nor the
// project's assets folder or inside it. Every write goes under {real}/{campaignId}, so that
// folder's real path and the assets folder must not be the same, nor one inside the other, and
// the app data folder must not be at or inside it (P8-5). The real
// path is the root from then on; the typed path is not used again. No path goes into an error
// or a log line: every failure is one sentence.
import fs from 'node:fs/promises'
import path from 'node:path'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { assetsDirOf } from '@/main/assets/service'
import { pathAtOrInside } from '@/main/assets/path-resolver'
import { exportRefusal } from '@/shared/export/messages'

const MAX_LENGTH = 4096

// The real path, so a link cannot hide where a folder is. A folder that is not there yet gets
// the real path of its nearest existing parent with the missing names after it.
async function realOrNearest(p: string): Promise<string> {
  const missing: string[] = []
  let current = path.resolve(p)
  for (;;) {
    try {
      return path.join(await fs.realpath(current), ...missing)
    } catch {
      const parent = path.dirname(current)
      if (parent === current) return path.resolve(p)
      missing.unshift(path.basename(current))
      current = parent
    }
  }
}

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

async function realFolder(typed: string): Promise<string> {
  let real: string
  try {
    real = await fs.realpath(typed)
  } catch (error) {
    throw exportRefusal(isMissing(error) ? 'output_dir_missing' : 'output_dir_refused')
  }
  const stats = await fs.stat(real).catch(() => null)
  if (!stats?.isDirectory()) throw exportRefusal('output_dir_refused')
  return real
}

export async function checkOutputDir(
  deps: Pick<CoreDeps, 'userDataDir'>,
  project: ProjectHandle,
  typed: string,
  campaignId: string,
): Promise<string> {
  if (typed.length > MAX_LENGTH || typed.includes('\u0000') || !path.isAbsolute(typed)) {
    throw exportRefusal('output_dir_refused')
  }
  const real = await realFolder(typed)
  const [userData, assets] = await Promise.all([
    realOrNearest(deps.userDataDir),
    realOrNearest(assetsDirOf(project)),
  ])
  // Real too: {real}/{campaignId} may already be a link.
  const campaignFolder = await realOrNearest(path.join(real, campaignId))
  if (
    pathAtOrInside(userData, real) ||
    pathAtOrInside(assets, real) ||
    pathAtOrInside(assets, campaignFolder) ||
    pathAtOrInside(campaignFolder, assets) ||
    pathAtOrInside(campaignFolder, userData)
  ) {
    throw exportRefusal('output_dir_refused')
  }
  return real
}
