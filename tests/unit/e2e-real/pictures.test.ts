import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, it, expect } from 'vitest'
import { checkPicture, pictureRefusal } from '../../e2e-real/pictures'
import { greyPng } from '@/main/providers/fake/png'
import { MAX_PICTURE_BYTES } from '@/main/providers/picture-limits'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-e2e-pictures-'))
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

function file(name: string, bytes: Uint8Array): string {
  const at = path.join(dir, name)
  fs.writeFileSync(at, bytes)
  return at
}

async function refusalOf(at: string, place: number): Promise<Error> {
  try {
    checkPicture(at, place)
  } catch (error) {
    return error as Error
  }
  throw new Error('the picture was not refused')
}

describe('a given product photo, the P-1 rules [SPEC 14 1.56 E2E-R, 1.54 P-1]', () => {
  it('takes a small PNG', () => {
    expect(() => checkPicture(file('secret-ok.png', greyPng(8, 6)), 1)).not.toThrow()
  })

  it('refuses a file that is not a PNG or a JPEG, naming its place only', async () => {
    const error = await refusalOf(file('secret-text.png', new Uint8Array([1, 2, 3, 4])), 2)
    expect(error.message).toBe(pictureRefusal(2))
    expect(error.message).not.toContain('secret')
    expect(error.cause).toBeUndefined()
  })

  it('refuses a picture over 1,600 px on its long side', async () => {
    const error = await refusalOf(file('secret-wide.png', greyPng(1601, 10)), 1)
    expect(error.message).toBe(pictureRefusal(1))
  })

  it('refuses a file over MAX_PICTURE_BYTES', async () => {
    const big = new Uint8Array(MAX_PICTURE_BYTES + 1)
    big.set(greyPng(8, 6))
    const error = await refusalOf(file('secret-big.png', big), 3)
    expect(error.message).toBe(pictureRefusal(3))
  })

  it('refuses a file that cannot be read, naming no path', async () => {
    const error = await refusalOf(path.join(dir, 'secret-missing.png'), 1)
    expect(error.message).toBe(pictureRefusal(1))
  })

  it('the refusal asks for a smaller copy made outside the repo', () => {
    expect(pictureRefusal(1)).toContain('outside the repo')
  })
})
