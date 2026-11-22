import { describe, expect, it } from 'vitest'
import { failureOf } from '../../../../helpers/failure-of'
import {
  bytes,
  MiB,
  routes,
  standIn,
  storage,
  store,
  streamOf,
  setUpDropboxStorage,
} from './storage-harness'

setUpDropboxStorage()

const PATH = 'folder/name.txt'
const argOf = (i: number) => JSON.parse(String(standIn.seen[i]?.headers['dropbox-api-arg']))

describe('writing [P9-3, phase-09 "Dropbox hosts and calls"]', () => {
  it('sends bytes up to 8 MiB in one upload, mode overwrite, mute', async () => {
    await storage().write(PATH, bytes(8 * MiB), 'image/png')
    expect(routes().filter((r) => r.startsWith('files/'))).toEqual(['files/upload'])
    const upload = standIn.seen.find((s) => s.route === 'files/upload')
    expect(JSON.parse(String(upload?.headers['dropbox-api-arg']))).toEqual({
      path: `/Root/${PATH}`,
      mode: 'overwrite',
      autorename: false,
      mute: true,
      strict_conflict: false,
    })
    expect(upload?.headers['content-type']).toBe('application/octet-stream')
  })

  it.each([
    ['bytes over 8 MiB', () => bytes(8 * MiB + 5)],
    ['a stream over 8 MiB', () => streamOf(bytes(8 * MiB + 5), 3 * MiB + 1)],
  ])('sends %s as start, append_v2 in 8 MiB parts, finish', async (_name, data) => {
    await storage().write(PATH, data(), 'video/mp4')
    const session = standIn.seen.filter((s) => s.route.startsWith('files/upload_session'))
    expect(session.map((s) => [s.route.slice(21), s.body.length])).toEqual([
      ['start', 0],
      ['append_v2', 8 * MiB],
      ['append_v2', 5],
      ['finish', 0],
    ])
    const args = session.map((s) => JSON.parse(String(s.headers['dropbox-api-arg'])))
    const id = args[1].cursor.session_id
    expect(args.slice(1, 3).map((a) => a.cursor)).toEqual([
      { session_id: id, offset: 0 },
      { session_id: id, offset: 8 * MiB },
    ])
    expect(args[3]).toEqual({
      cursor: { session_id: id, offset: 8 * MiB + 5 },
      commit: {
        path: `/Root/${PATH}`,
        mode: 'overwrite',
        autorename: false,
        mute: true,
        strict_conflict: false,
      },
    })
    expect(await storage().read(PATH)).toEqual(bytes(8 * MiB + 5))
  })

  it('sends even a small stream through a session', async () => {
    await storage().write(PATH, streamOf(bytes(5), 2), 'text/plain')
    expect(routes().filter((r) => r.startsWith('files/upload'))).toEqual([
      'files/upload_session/start',
      'files/upload_session/append_v2',
      'files/upload_session/finish',
    ])
  })

  it('writes the argument as a header in ASCII, never in the address', async () => {
    await storage('Café').write('naïve/ünï.txt', bytes(2), 'text/plain')
    const header = String(
      standIn.seen.find((s) => s.route === 'files/upload')?.headers['dropbox-api-arg'],
    )
    expect(header).toMatch(/^[\x20-\x7e]+$/)
    expect(header).toContain('/Caf\\u00e9/na\\u00efve/\\u00fcn\\u00ef.txt')
    expect(argOf(standIn.seen.findIndex((s) => s.route === 'files/upload')).path).toBe(
      '/Café/naïve/ünï.txt',
    )
  })
})

describe('exists, read, list and remove [P9-3]', () => {
  it('exists is true for a file and false for path/not_found and for a folder', async () => {
    await storage().write('a/b.txt', bytes(1), 'text/plain')
    expect(await storage().exists('a/b.txt')).toBe(true)
    expect(await storage().exists('a')).toBe(false)
    expect(await storage().exists('a/missing.txt')).toBe(false)
  })

  it('reads no more bytes than Dropbox-API-Result gives as the size', async () => {
    standIn.once('files/download', {
      status: 200,
      text: 'abcdef',
      headers: { 'dropbox-api-result': '{"size":3}' },
    })
    expect(await failureOf(storage().read('a.txt'))).toEqual({
      kind: 'other',
      detail: 'Answer too large',
    })
    standIn.once('files/download', { status: 200, text: 'abc' })
    expect((await failureOf(storage().read('a.txt'))).kind).toBe('other')
  })

  it('lists only files under the asked folder whose path can be used again', async () => {
    const file = (display: string) => ({
      '.tag': 'file',
      path_lower: display.toLowerCase(),
      path_display: display,
    })
    const entries = [
      file('/Root/in/a.txt'),
      { '.tag': 'folder', path_lower: '/root/in/sub', path_display: '/Root/in/sub' },
      file('/Root/inside.txt'),
      file('/Other/in/b.txt'),
      file('/Root/in/bad?.txt'),
      file('/ROOT/IN/C.txt'),
    ]
    standIn.once('files/list_folder', {
      status: 200,
      json: { entries, cursor: 'c', has_more: false },
    })
    expect(await storage().list('in')).toEqual(['in/a.txt', 'IN/C.txt'])
  })

  it('follows list_folder/continue to the last page', async () => {
    const written = ['l/1.txt', 'l/2.txt', 'l/3/4.txt', 'l/5.txt', 'l/6/7/8.txt']
    for (const path of written) await storage().write(path, bytes(1), 'text/plain')
    expect((await storage().list('l')).sort()).toEqual(written)
    expect(routes().filter((r) => r === 'files/list_folder/continue').length).toBeGreaterThan(1)
  })

  it('removing a missing file succeeds, and a file already gone at delete counts as removed', async () => {
    await storage().remove(['never.txt'])
    await storage().write('gone.txt', bytes(1), 'text/plain')
    standIn.once('files/delete_v2', { tag: 'path_lookup/not_found' })
    await storage().remove(['gone.txt'])
  })

  it('never removes a folder named in place of a file', async () => {
    await storage().write('folder/kept.txt', bytes(1), 'text/plain')
    expect((await failureOf(storage().remove(['folder']))).kind).toBe('other')
    expect(store.displayPaths()).toEqual(['/Root/folder/kept.txt'])
  })

  it('removes a file only at the revision it looked up', async () => {
    await storage().write('f.txt', bytes(1), 'text/plain')
    await storage().remove(['f.txt'])
    const del = standIn.seen.find((s) => s.route === 'files/delete_v2')
    expect(JSON.parse(String(del?.body))).toEqual({
      path: '/Root/f.txt',
      parent_rev: expect.any(String),
    })
  })
})
