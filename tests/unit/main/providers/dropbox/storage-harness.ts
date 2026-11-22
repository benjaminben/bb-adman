// The set-up the Dropbox storage tests share: the stand-in with its file routes, a fresh refresh
// token and an empty store before each test, and no console output from the adapter.
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest'
import { standInFetch, type DropboxStandIn } from '../../../../helpers/dropbox-stand-in'
import {
  startDropboxFilesStandIn,
  type DropboxFiles,
} from '../../../../helpers/dropbox-stand-in-files'
import { forgetDropboxAccess } from '@/main/providers/dropbox/access-token'
import { dropboxStorage } from '@/main/providers/dropbox/dropbox-storage'
import type { AdapterContext, StorageProvider } from '@/main/providers/types'
import { defaultSettings } from '@/main/settings/defaults'

export const MiB = 1024 * 1024
export let standIn: DropboxStandIn
export let store: DropboxFiles
export let refresh: string

export function setUpDropboxStorage(): void {
  const logs: unknown[][] = []
  beforeAll(async () => {
    ;({ standIn, store } = await startDropboxFilesStandIn())
  })
  afterAll(() => standIn.close())
  beforeEach(() => {
    forgetDropboxAccess()
    store.files.clear()
    standIn.seen.length = 0
    refresh = standIn.plantRefreshToken()
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args))
    }
  })
  afterEach(() => {
    vi.restoreAllMocks()
    expect(logs).toEqual([])
  })
}

function context(rootPath: string): AdapterContext {
  const settings = defaultSettings('/documents')
  settings.storage.dropbox = { accountName: 'Ann Example', rootPath }
  return { secret: () => refresh, settings: () => settings, model: () => '' }
}

export const storage = (rootPath = 'Root', fetch = standInFetch(standIn)): StorageProvider =>
  dropboxStorage(context(rootPath), { fetch, timeoutMs: 200 })
export const bytes = (n: number, seed = 7) =>
  Uint8Array.from({ length: n }, (_, i) => (i * seed) % 251)
export const routes = () => standIn.seen.map((s) => s.route)

export function streamOf(data: Uint8Array, chunk: number): ReadableStream<Uint8Array> {
  let at = 0
  return new ReadableStream({
    pull(controller) {
      if (at >= data.length) return controller.close()
      controller.enqueue(data.slice(at, at + chunk))
      at += chunk
    },
  })
}
