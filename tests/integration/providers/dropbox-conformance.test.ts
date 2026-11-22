// The shared storage cases, unchanged, against the Dropbox adapter and the stand-in on 127.0.0.1
// (spec/phases/phase-09-slices.md "P9-3"). Nothing here reaches Dropbox.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { standInFetch, type DropboxStandIn } from '../../helpers/dropbox-stand-in'
import { startDropboxFilesStandIn, type DropboxFiles } from '../../helpers/dropbox-stand-in-files'
import { adapters } from '@/main/providers/dropbox'
import { dropboxStorage } from '@/main/providers/dropbox/dropbox-storage'
import type { AdapterContext } from '@/main/providers/types'
import { defaultSettings } from '@/main/settings/defaults'
import { describeStorageConformance } from './storage-conformance'

let standIn: DropboxStandIn
let store: DropboxFiles
let refresh: string

beforeAll(async () => {
  ;({ standIn, store } = await startDropboxFilesStandIn())
  refresh = standIn.plantRefreshToken()
})
afterAll(() => standIn.close())

function context(rootPath: string): AdapterContext {
  const settings = defaultSettings('/documents')
  settings.storage.dropbox = { accountName: 'Ann Example', rootPath }
  return {
    secret: (name) => {
      if (name !== 'dropbox.refreshToken') throw new Error('unexpected secret')
      return refresh
    },
    settings: () => settings,
    model: () => '',
  }
}

const storageAt = (rootPath: string) =>
  dropboxStorage(context(rootPath), { fetch: standInFetch(standIn) })

describeStorageConformance('Dropbox, rootPath empty', () => storageAt(''))
describeStorageConformance('Dropbox, rootPath set', () => storageAt('Published/Spring'))

describe('Dropbox storage paths [P9-3, phase-09 "Dropbox hosts and calls"]', () => {
  it('joins every path to /{rootPath}/ inside the app folder, and to / when it is empty', async () => {
    await storageAt('Root Folder').write('a/b.txt', new Uint8Array([1]), 'text/plain')
    await storageAt('').write('top.txt', new Uint8Array([2]), 'text/plain')
    expect(store.displayPaths()).toEqual(
      expect.arrayContaining(['/Root Folder/a/b.txt', '/top.txt']),
    )
    expect(await storageAt('root folder').list('A')).toEqual(['a/b.txt'])
  })

  it('a set rootPath never lists or removes a file beside it', async () => {
    await storageAt('').write('Beside/keep.txt', new Uint8Array([3]), 'text/plain')
    await storageAt('').write('BesideX/keep.txt', new Uint8Array([3]), 'text/plain')
    const inner = storageAt('Beside/inner')
    await inner.write('mine.txt', new Uint8Array([4]), 'text/plain')
    expect(await inner.list('')).toEqual(['mine.txt'])
    await inner.remove(await inner.list(''))
    expect(store.displayPaths()).toEqual(
      expect.arrayContaining(['/Beside/keep.txt', '/BesideX/keep.txt']),
    )
  })

  it('the adapters object builds the Dropbox storage', () => {
    expect(adapters.storage).toBeTypeOf('function')
  })
})
