// The one way to write under the output folder (spec/phases/phase-08.md "The output folder
// (security)"). Security class. root is the real path checkOutputDir gave. Every name is a
// relative path under {root}/{campaignId}/ and passes the storage path rules; anything else
// throws "Storage path refused", which holds no path, before anything is touched. Writes go
// through localStorageAt, which refuses a link at the file, a link that leads nowhere and any
// folder whose real path leaves the real root, and writes through {name}.partial.
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { localStorageAt } from '@/main/providers/local-storage'
import { onDisk } from '@/main/providers/local-storage/failure'
import { refusePath, storageFilePath } from '@/main/providers/storage-paths'
import { CampaignId } from '@/shared/approvals/contract'
import type { ExportTarget } from './types'

export type ExportTargetAt = ExportTarget & {
  // A-193: for a report. Never replaces anything; false when the name is taken.
  writeNew(path: string, data: Uint8Array): Promise<boolean>
  // The path on disk of a name under the root, for a caller that must name the file to the
  // system (P8-9). The same check as write; nothing is read or written.
  fullPath(path: string): string
}

// A file below a campaign folder: at least {campaignId}/{name}.
function checkName(path: string): string[] {
  const parts = storageFilePath(path).split('/')
  if (parts.length < 2 || !CampaignId.safeParse(parts[0]).success) refusePath()
  return parts
}

// Local storage keeps no content type.
const CONTENT_TYPE = 'application/octet-stream'

export function exportTarget(root: string): ExportTargetAt {
  if (!nodePath.isAbsolute(root)) refusePath()
  const storage = localStorageAt(root)

  // P8-2 review L1: checked again before each write, so a root swapped for a link (or one
  // reached through a link) after checkOutputDir is refused. A disk error names no path.
  const checkRoot = () =>
    onDisk(async () => {
      if ((await fs.lstat(root)).isSymbolicLink()) refusePath()
      if ((await fs.realpath(root)) !== root) refusePath()
    })

  return {
    async write(path, data) {
      checkName(path)
      await checkRoot()
      await storage.write(path, data, CONTENT_TYPE)
    },
    async writeNew(path, data) {
      checkName(path)
      await checkRoot()
      return storage.writeNew(path, data)
    },
    async exists(path) {
      checkName(path)
      return storage.exists(path)
    },
    fullPath(path) {
      return nodePath.join(root, ...checkName(path))
    },
  }
}
