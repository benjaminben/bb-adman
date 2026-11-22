// P9-3b: Dropbox storage reached through the app's own path (storageFor, dev.storage) uses the
// core's injected dropboxFetch, never the default one that goes to the real network. The default
// is replaced here by a fetch that throws if called; nothing in this file reaches Dropbox.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeCrypto } from '../core-fixture'
import { standInFetch, type DropboxStandIn } from '../../helpers/dropbox-stand-in'
import { startDropboxFilesStandIn, type DropboxFiles } from '../../helpers/dropbox-stand-in-files'
import { createCore, type Core } from '@/main/core'
import { adapters } from '@/main/providers/dropbox'
import { forgetDropboxAccess } from '@/main/providers/dropbox/access-token'
import { storageFor } from '@/main/publish/storage-for'

const realNetwork = vi.hoisted(() =>
  vi.fn(async (): Promise<Response> => {
    throw new Error('the real network was called')
  }),
)
vi.mock('@/main/providers/dropbox/fetch', () => ({ defaultDropboxFetch: realNetwork }))

let standIn: DropboxStandIn
let store: DropboxFiles
let root: string
let core: Core

beforeAll(async () => {
  ;({ standIn, store } = await startDropboxFilesStandIn())
})
afterAll(() => standIn.close())

beforeEach(() => {
  forgetDropboxAccess()
  realNetwork.mockClear()
  standIn.seen.length = 0
  store.files.clear()
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-dropbox-fetch-'))
  const documents = path.join(root, 'Documents')
  fs.mkdirSync(documents, { recursive: true })
  core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: documents,
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: {},
    emit: () => undefined,
    askPermission: async () => false,
    devTools: true,
    dropboxFetch: standInFetch(standIn),
  })
  core.secrets.set('dropbox.refreshToken', standIn.plantRefreshToken())
  core.settings.setDropbox({ accountName: 'Ann Example', rootPath: 'Adman' })
})
afterEach(() => {
  forgetDropboxAccess()
  core.closeAll()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('Dropbox storage uses the injected fetch [P9-3b]', () => {
  it('storageFor sends every call, the token call too, to the injected fetch', async () => {
    const storage = storageFor(core.deps, 'dropbox')
    await storage.write('a/b.txt', new Uint8Array([1, 2]), 'text/plain')
    expect(await storage.list('a')).toEqual(['a/b.txt'])
    const routes = standIn.seen.map((s) => s.route)
    expect(routes).toContain('token')
    expect(routes).toContain('files/upload')
    expect(realNetwork).not.toHaveBeenCalled()
  })

  it('dev.storage { storage: dropbox } is answered by the injected fetch', async () => {
    const result = await core.bus.execute(
      'dev.storage',
      { storage: 'dropbox', action: 'list' },
      { actor: 'user' },
    )
    expect(result).toMatchObject({ ok: true, data: { names: [] } })
    expect(standIn.seen.map((s) => s.route)).toContain('files/list_folder')
    expect(realNetwork).not.toHaveBeenCalled()
  })

  it('a context with no Dropbox fetch is refused, never sent over the default one', () => {
    const settings = core.deps.settings.get()
    const ctx = { secret: () => 'unused', settings: () => settings, model: () => '' }
    expect(() => adapters.storage?.(ctx)).toThrow('No Dropbox fetch was handed in')
    expect(realNetwork).not.toHaveBeenCalled()
  })
})
