import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { checkLocalRoot } from '@/main/commands/dev/local-root'
import { ProviderFailure } from '@/main/providers/types'
import { AppError } from '@/shared/schemas/result'

let base: string
let root: string
let folder: string

beforeEach(() => {
  base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-root-')))
  root = path.join(base, 'hand-test-local')
  folder = path.join(root, 'adman-hand-test')
})
afterEach(() => fs.rmSync(base, { recursive: true, force: true }))

// What checkLocalRoot ends with: 'ok', the AppError reason, or the ProviderFailure kind.
async function outcome(): Promise<string> {
  try {
    await checkLocalRoot(root)
    return 'ok'
  } catch (e) {
    if (e instanceof AppError) return `${e.code} ${String(e.details?.reason)}`
    if (e instanceof ProviderFailure) return `${e.error.kind} ${e.error.detail}`
    throw e
  }
}

const UNSAFE = 'RULE_VIOLATION storage_folder_unsafe'

describe('the local hand-test root check [SPEC 4.2 1.21 F-01, 14 M1, review F-3]', () => {
  it('passes when the root is missing', async () => {
    expect(await outcome()).toBe('ok')
  })

  it('passes when the root and the hand-test folder are plain folders', async () => {
    fs.mkdirSync(folder, { recursive: true })
    expect(await outcome()).toBe('ok')
  })

  it('refuses a root that is a link to a folder', async () => {
    fs.mkdirSync(path.join(base, 'elsewhere'))
    fs.symlinkSync(path.join(base, 'elsewhere'), root)
    expect(await outcome()).toBe(UNSAFE)
  })

  it('refuses a root that is a file', async () => {
    fs.writeFileSync(root, 'not a folder')
    expect(await outcome()).toBe(UNSAFE)
  })

  it('refuses a hand-test folder that is a link to another folder inside the root', async () => {
    fs.mkdirSync(path.join(root, 'other'), { recursive: true })
    fs.symlinkSync(path.join(root, 'other'), folder)
    expect(await outcome()).toBe(UNSAFE)
  })

  it('refuses a hand-test folder that is a file', async () => {
    fs.mkdirSync(root)
    fs.writeFileSync(folder, 'not a folder')
    expect(await outcome()).toBe(UNSAFE)
  })

  it('gives ProviderFailure other with the code when lstat fails with ENOTDIR [1.22 M8]', async () => {
    fs.writeFileSync(path.join(base, 'a-file'), 'x')
    root = path.join(base, 'a-file', 'hand-test-local')
    expect(await outcome()).toBe('other ENOTDIR')
  })
})
