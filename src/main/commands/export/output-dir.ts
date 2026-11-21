// The output folder check (spec/phases/phase-08.md "The output folder (security)"). Security
// class: the path comes from the window. It must be absolute, at most 4,096 characters, with
// no NUL; its real path must be a folder, not the app data folder or inside it, nor the
// project's assets folder or inside it. The real path is the root from then on; the typed path
// is not used again. No path goes into an error or a log line: every failure is one sentence.
import fs from 'node:fs/promises'
import path from 'node:path'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { assetsDirOf } from '@/main/assets/service'
import { pathAtOrInside } from '@/main/assets/path-resolver'
import { exportRefusal } from '@/shared/export/messages'

const MAX_LENGTH = 4096

// The real path, so a link cannot hide where a folder is. A folder that is not there holds
// nothing, so its own resolved path is enough to compare against.
function realOrSelf(p: string): Promise<string> {
  return fs.realpath(p).catch(() => path.resolve(p))
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
): Promise<string> {
  if (typed.length > MAX_LENGTH || typed.includes('\u0000') || !path.isAbsolute(typed)) {
    throw exportRefusal('output_dir_refused')
  }
  const real = await realFolder(typed)
  const [userData, assets] = await Promise.all([
    realOrSelf(deps.userDataDir),
    realOrSelf(assetsDirOf(project)),
  ])
  if (pathAtOrInside(userData, real) || pathAtOrInside(assets, real)) {
    throw exportRefusal('output_dir_refused')
  }
  return real
}
