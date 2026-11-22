// spec/approvals.md "Pictures": the picture store on the user's own S3 bucket. put, list and
// remove go through the existing StorageProvider (adapterFor after requireProviderKeys), so the
// S3 prefix, the host pin and the error rules apply unchanged; signedUrl calls the adapter's
// signedReadUrl, which signs on this machine. Every path is checked by picture-paths.ts before
// the key guard and before any call, so nothing outside one campaign's folder is reached.
import type { CoreDeps } from '@/main/core-deps'
import { adapterFor } from '@/main/providers/adapters'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { ProviderFailure, type StorageProvider } from '@/main/providers/types'
import {
  checkPictureFolder,
  checkPictureLifetime,
  pictureFolderOf,
  picturesIn,
  removalFolder,
} from '@/shared/approvals/picture-paths'
import type { PictureStore } from './types'

export type S3PictureStoreDeps = Pick<CoreDeps, 'providers' | 'secrets' | 'settings' | 'now'>

// `storage` replaces the S3 adapter in tests; the key guard still runs first.
type Options = { storage?: (deps: S3PictureStoreDeps) => StorageProvider }

const PURPOSE = 'share pictures for approval'

export function s3PictureStore(deps: S3PictureStoreDeps, options: Options = {}): PictureStore {
  const build = options.storage ?? ((d: S3PictureStoreDeps) => adapterFor(d, 's3', 'storage'))

  function storage(): StorageProvider {
    requireProviderKeys(deps, 's3', PURPOSE)
    return build(deps)
  }

  return {
    async put(path, png) {
      pictureFolderOf(path, 'png')
      await storage().write(path, png, 'image/png')
    },

    // lib-storage sends a large stream in parts.
    async putClip(path, data) {
      pictureFolderOf(path, 'mp4')
      await storage().write(path, data, 'video/mp4')
    },

    async signedUrl(path, seconds) {
      pictureFolderOf(path)
      checkPictureLifetime(seconds)
      const s3 = storage()
      if (!s3.signedReadUrl) {
        throw new ProviderFailure({ kind: 'other', detail: 'This storage cannot sign addresses' })
      }
      const from = deps.now().getTime()
      const url = await s3.signedReadUrl(path, seconds)
      return { url, expiresAt: new Date(from + seconds * 1000).toISOString() }
    },

    async list(folder) {
      checkPictureFolder(folder)
      return picturesIn(folder, await storage().list(folder))
    },

    async remove(paths) {
      if (removalFolder(paths) === null) return
      await storage().remove(paths)
    },
  }
}
