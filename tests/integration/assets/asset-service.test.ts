import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createAssetService } from '../../../src/main/assets/service'
import {
  closeProjectFile,
  createProjectFile,
  type ProjectHandle,
} from '../../../src/main/db/project-file'
import { writeMeta } from '../../../src/main/db/meta'
import { AppError } from '../../../src/shared/schemas/result'
import { insertTestAsset } from './asset-rows'

let root: string
let project: ProjectHandle
const assets = createAssetService()
const ID = '01JD0000000000000000000001'

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-assets-'))
  project = createProjectFile({
    filePath: path.join(root, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: '2026-11-20T10:00:00.000Z',
  })
})
afterEach(() => {
  closeProjectFile(project)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('AssetService.assetsDir [SPEC 3.3 project_meta, 14 contracts A and C]', () => {
  it('gives the default folder beside the project file, not yet made', () => {
    expect(assets.assetsDir(project)).toBe(path.join(root, 'P Assets'))
    expect(fs.existsSync(path.join(root, 'P Assets'))).toBe(false)
  })

  it('reads the meta each time, so a changed folder is seen at once', () => {
    const moved = path.join(root, 'Moved')
    fs.mkdirSync(moved)
    writeMeta(project.db, { assetsDirRel: 'Moved', assetsDirAbs: moved })
    expect(assets.assetsDir(project)).toBe(moved)
  })
})

describe('AssetService.writeManaged [SPEC 14 contracts A and H, 3.1]', () => {
  it('writes {assetsDir}/{assetId}.{ext}, making the assets folder on first use', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    await assets.writeManaged(project, { assetId: ID, ext: 'png', bytes })
    expect(fs.readFileSync(path.join(root, 'P Assets', `${ID}.png`))).toEqual(Buffer.from(bytes))
  })

  it('refuses an ID or extension that could leave the assets folder', async () => {
    const bytes = new Uint8Array([1])
    await expect(
      assets.writeManaged(project, { assetId: '../x', ext: 'png', bytes }),
    ).rejects.toThrow()
    await expect(
      assets.writeManaged(project, { assetId: ID, ext: 'png/../../x', bytes }),
    ).rejects.toThrow()
    expect(fs.existsSync(path.join(root, 'P Assets'))).toBe(false)
  })

  it('never writes over a file that is already there', async () => {
    await assets.writeManaged(project, { assetId: ID, ext: 'png', bytes: new Uint8Array([1]) })
    await expect(
      assets.writeManaged(project, { assetId: ID, ext: 'png', bytes: new Uint8Array([2]) }),
    ).rejects.toThrow()
    expect(fs.readFileSync(path.join(root, 'P Assets', `${ID}.png`))).toEqual(Buffer.from([1]))
  })
})

describe('AssetService.resolve, read and missingAssetIds [SPEC 3.3 asset, FR-009]', () => {
  it('resolves a found file and reads its bytes and stored type', async () => {
    const file = path.join(root, 'pic.png')
    fs.writeFileSync(file, Buffer.from([9, 8, 7]))
    insertTestAsset(project.db, { id: ID, relPath: 'pic.png', absPath: '/nowhere/pic.png' })
    expect(await assets.resolve(project, ID)).toBe(file)
    const read = await assets.read(project, ID)
    expect(read).toEqual({ bytes: new Uint8Array([9, 8, 7]), mime: 'image/png' })
    expect(await assets.missingAssetIds(project)).toEqual([])
  })

  it('says missing, and read throws MISSING_FILE with the ID and no path', async () => {
    insertTestAsset(project.db, { id: ID, relPath: 'gone.png', absPath: path.join(root, 'g.png') })
    expect(await assets.resolve(project, ID)).toBe('missing')
    const error = await assets.read(project, ID).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).toBody()).toEqual({
      code: 'MISSING_FILE',
      message: 'A file this project uses cannot be found.',
      details: { assetIds: [ID] },
    })
    expect(await assets.missingAssetIds(project)).toEqual([ID])
  })

  it('gives NOT_FOUND for an asset ID the project does not hold', async () => {
    await expect(assets.resolve(project, ID)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(assets.read(project, ID)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
