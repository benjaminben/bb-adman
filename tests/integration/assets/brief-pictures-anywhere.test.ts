// R2P-3 (security class full) [D3, A-343 to A-346]: a brief a person loads or pastes may name
// a picture anywhere on the disk, or by the asset ID of an image in the open project. The
// normal checks still apply, and no path it names reaches a log line, an event or a reply note.
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { checkBriefPictures } from '@/main/assets/brief-pictures'
import { briefCommands } from '@/main/commands/brief'
import { makeAssetBus } from './asset-bus'
import { insertTestAsset } from './asset-rows'
import { testDeps } from '../campaigns/campaign-deps'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const IMAGE_ID = '01JABCDEFGHJKMNPQRSTVWXYZ0'
const VIDEO_ID = '01JABCDEFGHJKMNPQRSTVWXYZ1'
const UNKNOWN_ID = '01JABCDEFGHJKMNPQRSTVWXYZ2'

// Made at load, as the case tables below name paths in it.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-anywhere-'))
const real = fs.realpathSync(root)
const briefPath = path.join(root, 'brief/brief.json')
beforeAll(() => {
  fs.mkdirSync(path.join(root, 'brief'))
  fs.mkdirSync(path.join(root, 'elsewhere/folder.png'), { recursive: true })
  fs.writeFileSync(path.join(root, 'elsewhere/a.png'), PNG)
  fs.writeFileSync(path.join(root, 'elsewhere/b.png'), PNG)
  fs.writeFileSync(path.join(root, 'elsewhere/notes.txt'), 'private words')
  fs.writeFileSync(briefPath, '{}')
})
afterAll(() => fs.rmSync(root, { recursive: true, force: true }))
afterEach(() => vi.restoreAllMocks())

const elsewhere = (name: string) => path.join(real, 'elsewhere', name)

async function one(text: string, brief: string | null = briefPath) {
  const [result] = await checkBriefPictures(brief, [{ name: 'Can', pictures: [text] }])
  if (!result) throw new Error('No entry for the subject')
  return result
}

describe('a brief file may name a picture outside its folder [D3, R2P-3]', () => {
  it.each([
    ['../elsewhere/a.png', 'a.png'],
    [path.join(root, 'elsewhere/b.png'), 'b.png'],
  ])('accepts %j as its real path', async (text, name) => {
    expect(await one(text)).toEqual({ paths: [elsewhere(name)], assetIds: [], notes: [] })
  })

  it.each([
    ['../elsewhere/folder.png', 'folder.png', 'not_found'],
    [path.join(root, 'elsewhere/folder.png'), 'folder.png', 'not_found'],
    [path.join(root, 'elsewhere/notes.txt'), 'notes.txt', 'not_a_picture'],
    ['/etc/passwd', 'passwd', 'not_a_picture'],
    [path.join(root, 'elsewhere/gone.png'), 'gone.png', 'not_found'],
    [`${path.join(root, 'elsewhere/a.png')}\u0000.txt`, 'a.png.txt', 'not_found'],
  ])('gives %j the note %s %s', async (text, name, reason) => {
    expect(await one(text)).toEqual({ paths: [], assetIds: [], notes: [{ name, reason }] })
  })

  it('keeps nothing of a text file in the result', async () => {
    const result = await one(path.join(root, 'elsewhere/notes.txt'))
    expect(JSON.stringify(result)).not.toContain('private words')
  })
})

describe('a pasted brief has no folder [D3, R2P-3]', () => {
  it('gives a relative path not_full_path and reads no file', async () => {
    const spies = [
      vi.spyOn(fsp, 'realpath'),
      vi.spyOn(fsp, 'stat'),
      vi.spyOn(fsp, 'open'),
      vi.spyOn(fsp, 'readFile'),
    ]
    const [result] = await checkBriefPictures(null, [
      { pictures: ['a.png', '../elsewhere/a.png', '~/a.png', ''] },
    ])
    expect(result).toEqual({
      paths: [],
      assetIds: [],
      notes: [
        { name: 'a.png', reason: 'not_full_path' },
        { name: 'a.png', reason: 'not_full_path' },
        { name: 'a.png', reason: 'not_full_path' },
        { name: '(no name)', reason: 'not_full_path' },
      ],
    })
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })

  it('accepts an absolute path from pasted text', async () => {
    expect(await one(path.join(root, 'elsewhere/a.png'), null)).toEqual({
      paths: [elsewhere('a.png')],
      assetIds: [],
      notes: [],
    })
  })
})

describe('a brief may name a picture by its asset ID [D3, R2P-3]', () => {
  let bus: ReturnType<typeof makeAssetBus>
  beforeAll(() => {
    bus = makeAssetBus(briefCommands(testDeps()))
    const at = (id: string, kind: 'image' | 'video') =>
      insertTestAsset(bus.db, { id, kind, relPath: `assets/${id}`, absPath: `/x/${id}` })
    at(IMAGE_ID, 'image')
    at(VIDEO_ID, 'video')
  })
  afterAll(() => bus.cleanup())

  const parse = (pictures: string[], filePath?: string) => {
    const brief = JSON.stringify({ subjects: [{ name: 'Can', pictures }] })
    if (filePath === undefined) return bus.user('brief.parse', { text: brief })
    fs.writeFileSync(filePath, brief)
    return bus.user('brief.parse', { filePath })
  }

  it('puts an image of the project into assetIds, in either case, once', async () => {
    expect(await parse([IMAGE_ID, IMAGE_ID.toLowerCase()])).toMatchObject({
      ok: true,
      data: { subjectPictures: [{ paths: [], assetIds: [IMAGE_ID], notes: [] }] },
    })
  })

  it('gives an unknown ID and a video ID the same unknown_asset, from text or a file', async () => {
    const notes = [
      { name: UNKNOWN_ID, reason: 'unknown_asset' },
      { name: VIDEO_ID, reason: 'unknown_asset' },
    ]
    const want = { ok: true, data: { subjectPictures: [{ paths: [], assetIds: [], notes }] } }
    expect(await parse([UNKNOWN_ID, VIDEO_ID])).toMatchObject(want)
    expect(await parse([UNKNOWN_ID, VIDEO_ID], path.join(root, 'brief/ids.json'))).toMatchObject(
      want,
    )
  })

  it('without a project lookup, every asset ID is unknown_asset', async () => {
    expect(await one(IMAGE_ID)).toEqual({
      paths: [],
      assetIds: [],
      notes: [{ name: IMAGE_ID, reason: 'unknown_asset' }],
    })
  })

  it('puts no given path in a log line or an event', async () => {
    const outside = path.join(root, 'elsewhere/a.png')
    const named = ['../elsewhere/a.png', outside, '/etc/passwd', 'missing-photo.png', IMAGE_ID]
    const reply = await parse(named, path.join(root, 'brief/log.json'))
    expect(reply).toMatchObject({ ok: true })
    const pasted = await parse(['pasted-photo.png', outside])
    expect(pasted).toMatchObject({ ok: true })
    const said = bus.logText() + JSON.stringify(bus.events)
    for (const text of [root, real, 'elsewhere', 'passwd', 'missing-photo', 'pasted-photo']) {
      expect(said).not.toContain(text)
    }
  })
})
