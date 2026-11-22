// The video export's work folder (spec/phases/phase-08.md "Video"): {userData}/export-work/{ULID}/,
// the one place FFmpeg reads its copied sources and writes the ad. Security: the rules of the
// publish work folder (src/main/publish/work-folder.ts), reused under this base: the ID must be
// a ULID, a link at export-work is refused, both folders are this user's only (0o700), and the
// folder is removed on every path. Leftovers are removed at app start and before each new one.
import { makeWorkFolder, sweepWorkFolders, type WorkFolder } from '@/main/publish/work-folder'

export const EXPORT_WORK = 'export-work'

export function makeWorkDir(userDataDir: string, jobId: string): Promise<WorkFolder> {
  return makeWorkFolder(userDataDir, jobId, EXPORT_WORK)
}

// Never fails: a folder it cannot remove is left for the next start.
export function cleanLeftovers(userDataDir: string): Promise<void> {
  return sweepWorkFolders(userDataDir, EXPORT_WORK).catch(() => undefined)
}
