// spec/approvals.md "Pictures", A-97: the picture store for local tests. picture-store.ts
// chooses it only with dev tools on and ADMAN_APPROVALS_TEST_PICTURES set to exactly
// http://127.0.0.1:{port}. It writes under {userData}/approvals-test-pictures/ and gives the
// address {origin}/{path}; tests serve that folder from their own stand-in. Before every call
// the folder is looked at with lstat, as the hand-test folder is: a link or a file in its place
// is refused. Below it, local storage refuses any path that would leave it.
import fs from 'node:fs/promises'
import { localStorageAt } from '@/main/providers/local-storage'
import { REFUSED_PATH } from '@/main/providers/storage-paths'
import { ProviderFailure } from '@/main/providers/types'
import {
  checkPictureFolder,
  checkPictureLifetime,
  pictureFolderOf,
  picturesIn,
  removalFolder,
} from '@/shared/approvals/picture-paths'
import type { PictureStore } from './types'

export const TEST_PICTURES_FOLDER = 'approvals-test-pictures'

const ORIGIN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/

// The origin when the text is exactly http://127.0.0.1:{port} with a port from 1 to 65535.
export function testPicturesOrigin(text: string | undefined): string | null {
  const port = ORIGIN.exec(text ?? '')?.[1]
  return port !== undefined && Number(port) <= 65_535 ? `http://127.0.0.1:${port}` : null
}

async function lstatOrMissing(path: string) {
  return fs.lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined
    throw new ProviderFailure({ kind: 'other', detail: error.code ?? 'lstat failed' })
  })
}

// Makes the folder when it is missing; refuses a link or a file in its place.
async function checkRoot(root: string): Promise<void> {
  let stats = await lstatOrMissing(root)
  if (stats === undefined) {
    await fs.mkdir(root, { recursive: true })
    stats = await lstatOrMissing(root)
  }
  if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(REFUSED_PATH)
}

type Options = { root: string; origin: string; now: () => Date }

export function testPictureStore({ root, origin, now }: Options): PictureStore {
  const local = localStorageAt(root)

  return {
    async put(path, png) {
      pictureFolderOf(path)
      await checkRoot(root)
      await local.write(path, png, 'image/png')
    },

    async signedUrl(path, seconds) {
      pictureFolderOf(path)
      checkPictureLifetime(seconds)
      const expiresAt = new Date(now().getTime() + seconds * 1000).toISOString()
      return { url: `${origin}/${path}`, expiresAt }
    },

    async list(folder) {
      checkPictureFolder(folder)
      await checkRoot(root)
      return picturesIn(folder, await local.list(folder))
    },

    async remove(paths) {
      if (removalFolder(paths) === null) return
      await checkRoot(root)
      await local.remove(paths)
    },
  }
}
