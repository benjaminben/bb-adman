import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createAssetService } from '../../../src/main/assets/service'
import {
  closeProjectFile,
  createProjectFile,
  type ProjectHandle,
} from '../../../src/main/db/project-file'
import { AppError } from '../../../src/shared/schemas/result'
import { insertTestAsset, type TestAsset } from './asset-rows'

let root: string
let project: ProjectHandle
const ID = '01JD0000000000000000000001'
const LIMIT = 100

// One real 1 by 1 PNG, 68 bytes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0])

// A PNG signature followed by filler, so only its size can refuse it.
function pngOfSize(size: number): Buffer {
  const bytes = Buffer.alloc(size, 0)
  PNG.copy(bytes, 0, 0, 8)
  return bytes
}

function place(bytes: Buffer, row: Partial<TestAsset> = {}): void {
  fs.writeFileSync(path.join(root, 'pic.png'), bytes)
  insertTestAsset(project.db, { id: ID, relPath: 'pic.png', absPath: '/nowhere/pic.png', ...row })
}

async function refusal(promise: Promise<unknown>): Promise<ReturnType<AppError['toBody']>> {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(AppError)
  return (error as AppError).toBody()
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-assets-read-'))
  project = createProjectFile({
    filePath: path.join(root, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: '2026-11-20T10:00:00.000Z',
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  closeProjectFile(project)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('AssetService.read size limit [SPEC 14, 1.25 point 7, 1.27 R2]', () => {
  it('reads a picture exactly at the limit handed in', async () => {
    place(pngOfSize(LIMIT))
    const read = await createAssetService({ maxPictureBytes: LIMIT }).read(project, ID)
    expect(read.bytes.length).toBe(LIMIT)
    expect(read.mime).toBe('image/png')
  })

  it('refuses a file one byte over the limit with asset_too_large, and never opens it', async () => {
    place(pngOfSize(LIMIT + 1))
    const open = vi.spyOn(fs.promises, 'open')
    const readFile = vi.spyOn(fs.promises, 'readFile')
    const body = await refusal(createAssetService({ maxPictureBytes: LIMIT }).read(project, ID))
    expect(body.code).toBe('RULE_VIOLATION')
    expect(body.details).toEqual({ reason: 'asset_too_large' })
    expect(body.message).toBe(`${ID}.png is too large to send. The limit is 32 MB.`)
    expect(open).not.toHaveBeenCalled()
    expect(readFile).not.toHaveBeenCalled()
  })

  it('refuses a file that grew after import by its real size, not the row size', async () => {
    place(pngOfSize(LIMIT * 3))
    const row = project.db.prepare('SELECT byte_size FROM asset WHERE id = ?').get(ID)
    expect(row).toEqual({ byte_size: 1 })
    const body = await refusal(createAssetService({ maxPictureBytes: LIMIT }).read(project, ID))
    expect(body.details).toEqual({ reason: 'asset_too_large' })
  })

  it('checks the bytes read against the limit again, when the file grew after stat', async () => {
    place(pngOfSize(LIMIT + 1))
    const realStat = fs.promises.stat
    vi.spyOn(fs.promises, 'stat').mockImplementation(async (p, o) => {
      const stats = await realStat(p, o)
      Object.defineProperty(stats, 'size', { value: 1 })
      return stats
    })
    const body = await refusal(createAssetService({ maxPictureBytes: LIMIT }).read(project, ID))
    expect(body.details).toEqual({ reason: 'asset_too_large' })
  })

  it('uses MAX_PICTURE_BYTES (32 MB) when no limit is handed in', async () => {
    const big = path.join(root, 'pic.png')
    fs.writeFileSync(big, PNG)
    fs.truncateSync(big, 32 * 1024 * 1024 + 1)
    insertTestAsset(project.db, { id: ID, relPath: 'pic.png', absPath: '/nowhere/pic.png' })
    const body = await refusal(createAssetService().read(project, ID))
    expect(body.details).toEqual({ reason: 'asset_too_large' })
  })
})

describe('AssetService.read picture check [SPEC 14, 1.25 point 7, 1.27 R2]', () => {
  it('refuses a text asset with asset_not_a_picture, whatever its file holds', async () => {
    place(PNG, { kind: 'text', mime: 'text/plain' })
    const body = await refusal(createAssetService().read(project, ID))
    expect(body).toEqual({
      code: 'RULE_VIOLATION',
      message: `${ID}.png is not a picture the app can send.`,
      details: { reason: 'asset_not_a_picture' },
    })
  })

  it('refuses a picture row whose file now holds text', async () => {
    place(Buffer.from('now this is text'))
    const body = await refusal(createAssetService().read(project, ID))
    expect(body.details).toEqual({ reason: 'asset_not_a_picture' })
  })

  it('gives the type the bytes show: a JPEG under a PNG row comes back as image/jpeg', async () => {
    place(JPEG, { mime: 'image/png' })
    const read = await createAssetService().read(project, ID)
    expect(read).toEqual({ bytes: new Uint8Array(JPEG), mime: 'image/jpeg' })
  })
})
