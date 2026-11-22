import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  makeRunFolder,
  removeRunFolder,
  sweepRunFolders,
  writeRunFile,
} from '@/main/media/run-folder'

let userData = ''
beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-runfolder-'))
})
afterEach(() => fs.rmSync(userData, { recursive: true, force: true }))

const RUN = 'run-01JD0000000000000000000000'

describe('makeRunFolder (phase-07.md, "How FFmpeg is run")', () => {
  it('makes a run-{ULID} folder inside media-temp', async () => {
    const folder = await makeRunFolder(userData)
    expect(path.dirname(folder)).toBe(path.join(userData, 'media-temp'))
    expect(path.basename(folder)).toMatch(/^run-[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(fs.lstatSync(folder).isDirectory()).toBe(true)
  })

  it('refuses a link in place of media-temp', async () => {
    const elsewhere = path.join(userData, 'elsewhere')
    fs.mkdirSync(elsewhere)
    fs.symlinkSync(elsewhere, path.join(userData, 'media-temp'))
    await expect(makeRunFolder(userData)).rejects.toThrow()
    expect(fs.readdirSync(elsewhere)).toEqual([])
  })

  it('writes a file once and refuses to overwrite it', async () => {
    const folder = await makeRunFolder(userData)
    await writeRunFile(folder, 'in.mp4', new Uint8Array([1, 2]))
    expect([...fs.readFileSync(path.join(folder, 'in.mp4'))]).toEqual([1, 2])
    await expect(writeRunFile(folder, 'in.mp4', new Uint8Array([3]))).rejects.toThrow()
  })

  it('removes the folder and what is in it', async () => {
    const folder = await makeRunFolder(userData)
    await writeRunFile(folder, 'meta.txt', 'x')
    await removeRunFolder(userData, folder)
    expect(fs.existsSync(folder)).toBe(false)
  })

  it('removes nothing outside media-temp', async () => {
    const other = path.join(userData, RUN)
    fs.mkdirSync(other)
    await removeRunFolder(userData, other)
    expect(fs.existsSync(other)).toBe(true)
  })
})

describe('sweepRunFolders', () => {
  it('removes only real run-* folders', async () => {
    const temp = path.join(userData, 'media-temp')
    fs.mkdirSync(path.join(temp, RUN), { recursive: true })
    fs.writeFileSync(path.join(temp, RUN, 'out.mp4'), 'x')
    const kept = path.join(userData, 'kept')
    fs.mkdirSync(kept)
    fs.writeFileSync(path.join(kept, 'precious'), 'x')
    fs.symlinkSync(kept, path.join(temp, 'run-01JD0000000000000000000001'))
    fs.writeFileSync(path.join(temp, 'run-01JD0000000000000000000002'), 'x')
    fs.mkdirSync(path.join(temp, 'other'))

    await sweepRunFolders(userData)

    expect(fs.readdirSync(temp).sort()).toEqual([
      'other',
      'run-01JD0000000000000000000001',
      'run-01JD0000000000000000000002',
    ])
    expect(fs.existsSync(path.join(kept, 'precious'))).toBe(true)
  })

  it('does nothing when media-temp is a link', async () => {
    const elsewhere = path.join(userData, 'elsewhere')
    fs.mkdirSync(path.join(elsewhere, RUN), { recursive: true })
    fs.symlinkSync(elsewhere, path.join(userData, 'media-temp'))
    await sweepRunFolders(userData)
    expect(fs.existsSync(path.join(elsewhere, RUN))).toBe(true)
  })

  it('does nothing when media-temp is missing', async () => {
    await expect(sweepRunFolders(userData)).resolves.toBeUndefined()
  })
})
