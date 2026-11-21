import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { referenceFiles } from '../../live/reference-files'
import { circlePng } from '../../live/shape-picture'

// A JPEG start (SOI, then an APP0 marker); pictureType reads only the signature.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const PNG = circlePng(8)

let folder = ''

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-reference-files-test-'))
  fs.writeFileSync(path.join(folder, 'a.png'), PNG)
  fs.writeFileSync(path.join(folder, 'b.jpg'), JPEG)
  fs.writeFileSync(path.join(folder, 'c.png'), PNG)
  fs.writeFileSync(path.join(folder, 'd.png'), PNG)
  fs.writeFileSync(path.join(folder, 'notes.txt'), 'plain words, not a picture')
})

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true })
})

describe('reference files for the live reference case [SPEC 14 1.46, OI-79]', () => {
  it('gives nothing when the variable is not set or empty', () => {
    expect(referenceFiles(undefined, folder)).toBeUndefined()
    expect(referenceFiles('', folder)).toBeUndefined()
  })

  it('reads a PNG and a JPEG, relative to the root or absolute, in the order given', () => {
    const value = `b.jpg, ${path.join(folder, 'a.png')}`
    const files = referenceFiles(value, folder)
    expect(files?.map((f) => f.mime)).toEqual(['image/jpeg', 'image/png'])
    expect(files?.[0]?.bytes).toEqual(JPEG)
    expect(files?.[1]?.bytes).toEqual(PNG)
  })

  it('refuses a file that is not a PNG or a JPEG, naming its place and not its path', () => {
    const run = () => referenceFiles('a.png,notes.txt', folder)
    expect(run).toThrow('Reference file 2 is not a PNG or a JPEG')
    expect(() => run()).not.toThrow(/notes|adman-reference/)
  })

  it('refuses four files', () => {
    expect(() => referenceFiles('a.png,b.jpg,c.png,d.png', folder)).toThrow(
      'ADMAN_LIVE_REFERENCE_FILES names 4 files; at most 3 are allowed',
    )
  })

  it('refuses a file that cannot be read, naming its place and not its path', () => {
    const run = () => referenceFiles('missing.png', folder)
    expect(run).toThrow('Reference file 1 could not be read')
    expect(() => run()).not.toThrow(/missing|adman-reference/)
  })
})
