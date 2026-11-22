// P9-7 (spec/phases/phase-09.md "Publishing", components, A-222, A-223; "Project-file values that
// reach a path"): the component list of a campaign comes from the layers and clips of the
// exported variants, one folder each, and every file is checked before it can be uploaded.
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { collectComponents, type CollectedComponent } from '@/main/publish/components'
import { checkComponentFile } from '@/main/publish/component-file'
import { readWireRows } from '@/main/db/rows'
import { campaignPath } from '@/shared/publish/paths'
import { storageFilePath } from '@/main/providers/storage-paths'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { BYTES, CAMPAIGN, makeComponentProject } from './component-project'

const id = (n: number) => `01JD${String(n).padStart(22, '0')}`
const BG = id(1)
const CLIP = id(2)
const IMG = id(3)
const LOGO = id(4)
const SUBJ = id(5)
const FONT_OK = id(6)
const FONT_NO = id(7)
const GEN = id(8)
const REF = id(9)
const UNEXPORTED = id(10)
const OTHER_CAMPAIGN = id(11)
const SUBJECT = '01JD00000000000000000000S1'
const EXPORTED = ['vaaaaa', 'vbbbbb', 'vzzzzz']

let p: ReturnType<typeof makeComponentProject>
beforeEach(() => {
  p = makeComponentProject()
})
afterEach(() => p.cleanup())

const collect = () => collectComponents(p.handle, { campaignId: CAMPAIGN, variantIds: EXPORTED })
const byId = (list: CollectedComponent[], assetId: string) =>
  list.find((c) => c.assetId === assetId)

describe('collectComponents, folders [P9-7, A-222]', () => {
  let files: Record<string, string>
  beforeEach(() => {
    p.subject(SUBJECT)
    files = {
      [BG]: p.asset({ id: BG, file: 'bg.png', displayName: 'Beach' }),
      [CLIP]: p.asset({ id: CLIP, file: 'wave.mp4', bytes: BYTES.mp4, kind: 'video' }),
      [IMG]: p.asset({ id: IMG, file: 'img.png', displayName: 'Bottle' }),
      [LOGO]: p.asset({ id: LOGO, file: 'logo.png', displayName: 'Logo' }),
      [SUBJ]: p.asset({ id: SUBJ, file: 'hero.png', subjectId: SUBJECT, displayName: 'Hero' }),
      [FONT_OK]: p.asset({
        id: FONT_OK,
        file: 'ok.ttf',
        bytes: BYTES.ttf,
        kind: 'font',
        fontPublishAllowed: true,
        displayName: 'Open Sans',
      }),
      [FONT_NO]: p.asset({ id: FONT_NO, file: 'no.ttf', bytes: BYTES.ttf, kind: 'font' }),
    }
    p.asset({ id: GEN, file: 'gen.png', genRunId: id(99) })
    p.asset({ id: REF, file: 'ref.png', library: 'reference' })
    p.asset({ id: UNEXPORTED, file: 'unexported.png' })
    p.asset({ id: OTHER_CAMPAIGN, file: 'other.png' })
    p.required([LOGO])
    p.layer('vaaaaa', { background: BG })
    p.clip('vaaaaa', CLIP)
    p.layer('vaaaaa', { image: IMG })
    p.layer('vbbbbb', { image: IMG })
    p.layer('vbbbbb', { background: LOGO })
    p.layer('vbbbbb', { image: SUBJ })
    p.layer('vaaaaa', { font: FONT_OK })
    p.layer('vbbbbb', { font: FONT_NO })
    p.layer('vaaaaa', { image: REF })
    p.layer('vccccc', { image: UNEXPORTED })
    p.layer('vzzzzz', { image: OTHER_CAMPAIGN })
  })

  it('puts each used asset in its folder, once, with its checked file and upload path', async () => {
    const list = await collect()
    expect(list.map((c) => c.assetId).sort()).toEqual(
      [BG, CLIP, IMG, LOGO, SUBJ, FONT_OK, FONT_NO].sort(),
    )
    const row = (assetId: string) => byId(list, assetId)
    expect(row(BG)).toMatchObject({ folder: 'backgrounds', kind: 'image', problem: null })
    expect(row(BG)?.remotePath).toBe('components/backgrounds/Beach-01JD0000.png')
    expect(row(CLIP)).toMatchObject({ folder: 'backgrounds', kind: 'video', shareAllowed: null })
    expect(row(CLIP)?.remotePath).toMatch(/^components\/backgrounds\/.+-01JD0000\.mp4$/)
    expect(row(IMG)).toMatchObject({
      folder: 'images',
      remotePath: 'components/images/Bottle-01JD0000.png',
    })
    expect(row(LOGO)).toMatchObject({
      folder: 'logos',
      remotePath: 'components/logos/Logo-01JD0000.png',
    })
    expect(row(SUBJ)?.remotePath).toBe(`components/subjects/${SUBJECT}/Hero-01JD0000.png`)
    expect(row(FONT_OK)).toMatchObject({ folder: 'fonts', kind: 'font', shareAllowed: true })
    expect(row(FONT_OK)?.remotePath).toBe('components/fonts/Open Sans-01JD0000.ttf')
    expect(row(FONT_NO)).toMatchObject({ folder: 'fonts', shareAllowed: false, problem: null })
    expect(row(FONT_NO)?.remotePath).toBeNull()
    for (const c of list) {
      expect(c.localPath).toBe(files[c.assetId])
      if (c.remotePath) expect(c.absPath).toBe(files[c.assetId])
    }
  })

  it('keeps the share rule for a font that lands in another folder', async () => {
    p.required([LOGO, FONT_NO, FONT_OK])
    const list = await collect()
    expect(byId(list, FONT_NO)).toMatchObject({
      folder: 'logos',
      shareAllowed: false,
      remotePath: null,
    })
    expect(byId(list, FONT_OK)?.remotePath).toBe('components/logos/Open Sans-01JD0000.ttf')
  })

  it('leaves out every asset of a variant that is not exported or not in the campaign', async () => {
    const list = await collectComponents(p.handle, { campaignId: CAMPAIGN, variantIds: ['vccccc'] })
    expect(list.map((c) => c.assetId)).toEqual([UNEXPORTED])
    expect(await collectComponents(p.handle, { campaignId: CAMPAIGN, variantIds: [] })).toEqual([])
  })
})

describe('collectComponents, hostile rows [P9-7, security]', () => {
  const BAD_SUBJECT = id(20)
  const TEXT = id(21)
  const RENAMED = id(22)
  const MISSING = id(23)
  const NOT_ULID = '../../../evil'
  const LINKED_ELSEWHERE = id(24)
  let files: Record<string, string>

  beforeEach(() => {
    p.subject('../../x')
    files = {
      [BAD_SUBJECT]: p.asset({ id: BAD_SUBJECT, file: 'bs.png', subjectId: '../../x' }),
      [TEXT]: p.asset({ id: TEXT, file: 'notes.txt', bytes: BYTES.text, kind: 'text' }),
      [RENAMED]: p.asset({ id: RENAMED, file: 'renamed.png', bytes: BYTES.text }),
      [MISSING]: p.asset({ id: MISSING, file: null }),
      [NOT_ULID]: p.asset({
        id: NOT_ULID,
        file: 'evil.png',
        displayName: '../../../../etc/passwd',
      }),
      [LINKED_ELSEWHERE]: p.asset({ id: LINKED_ELSEWHERE, file: 'font.png', bytes: BYTES.ttf }),
    }
    p.required([NOT_ULID, 42, { a: 1 }] as unknown as string[])
    for (const a of [BAD_SUBJECT, TEXT, RENAMED, NOT_ULID, LINKED_ELSEWHERE]) {
      p.layer('vaaaaa', { image: a })
    }
    p.layer('vaaaaa', { background: MISSING })
    p.layer('vaaaaa', { font: TEXT })
  })

  it('gives each its problem and no upload, and never a path outside the row', async () => {
    const list = await collect()
    const row = (assetId: string) => byId(list, assetId)
    expect(row(BAD_SUBJECT)).toMatchObject({ folder: 'images', problem: null })
    expect(row(BAD_SUBJECT)?.remotePath).toBe(`components/images/Name ${BAD_SUBJECT}-01JD0000.png`)
    expect(row(TEXT)).toMatchObject({ problem: 'wrong_type', remotePath: null, absPath: null })
    expect(row(RENAMED)).toMatchObject({ problem: 'wrong_type', remotePath: null, absPath: null })
    expect(row(LINKED_ELSEWHERE)).toMatchObject({ problem: 'wrong_type', remotePath: null })
    expect(row(MISSING)).toMatchObject({
      problem: 'missing',
      folder: 'backgrounds',
      remotePath: null,
    })
    expect(row(NOT_ULID)).toMatchObject({ problem: 'missing', remotePath: null, absPath: null })
    expect(list.filter((c) => c.assetId === TEXT)).toHaveLength(1)
    for (const c of list) expect(c.localPath).toBe(files[c.assetId])
    for (const c of list.filter((x) => x.remotePath !== null)) {
      const full = campaignPath(CAMPAIGN, c.remotePath as string)
      expect(full.startsWith(`${CAMPAIGN}/components/`)).toBe(true)
      expect(storageFilePath(full)).toBe(full)
    }
  })

  it('ignores a layer source or clip that is not JSON or names no asset', async () => {
    p.db.prepare("UPDATE layer SET source = 'not json' WHERE source LIKE ?").run(`%${RENAMED}%`)
    p.db.prepare('UPDATE layer SET source = \'{"assetId":7}\' WHERE source LIKE ?').run(`%${TEXT}%`)
    p.db.prepare("UPDATE rule_set SET required_asset_ids = 'nope'").run()
    const list = await collect()
    expect(byId(list, RENAMED)).toBeUndefined()
    expect(byId(list, TEXT)?.kind).toBe('font')
  })
})

describe('checkComponentFile [P9-7, "Project-file values that reach a path"]', () => {
  const rowOf = (assetId: string) =>
    (readWireRows(p.db, 'asset') as AssetRow[]).find((r) => r.id === assetId) as AssetRow

  it.each([
    ['a PNG named .png', { file: 'a.png' }, 'png'],
    ['a PNG named .PNG', { file: 'b.PNG' }, 'png'],
    ['an MP4 video', { file: 'c.mp4', bytes: BYTES.mp4, kind: 'video' as const }, 'mp4'],
    ['a TTF font', { file: 'd.ttf', bytes: BYTES.ttf, kind: 'font' as const }, 'ttf'],
  ])('accepts %s', async (_label, a, ext) => {
    const file = p.asset({ id: id(30), ...a })
    expect(await checkComponentFile(p.handle, rowOf(id(30)))).toEqual({ absPath: file, ext })
  })

  it.each([
    ['a missing file', { file: null }, 'missing'],
    ['a folder in place of the file', { file: 'dir.png/inner.png' }, 'missing'],
    ['a text row', { file: 't.txt', bytes: BYTES.text, kind: 'text' as const }, 'wrong_type'],
    ['a PNG row whose bytes are text', { file: 'r.png', bytes: BYTES.text }, 'wrong_type'],
    ['a video row named .png', { file: 'v.png', kind: 'video' as const }, 'wrong_type'],
    ['an image row with no extension', { file: 'noext' }, 'wrong_type'],
  ])('refuses %s', async (_label, a, problem) => {
    p.asset({ id: id(31), ...a })
    const row = rowOf(id(31))
    if (a.file?.startsWith('dir.png')) row.absPath = path.dirname(row.absPath)
    if (a.file?.startsWith('dir.png')) row.relPath = path.dirname(row.relPath)
    expect(await checkComponentFile(p.handle, row)).toEqual({ problem })
  })

  it('treats a row whose ID is not a ULID as missing', async () => {
    p.asset({ id: 'abc/../x', file: 'x.png' })
    expect(await checkComponentFile(p.handle, rowOf('abc/../x'))).toEqual({ problem: 'missing' })
  })
})
