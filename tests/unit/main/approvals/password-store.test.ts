// The kept passwords (spec/approvals.md "Kept passwords", security class): one encrypted map in
// {userData}/approval-passwords.bin, with the secret store's rules.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createPasswordStore } from '@/main/approvals/password-store'
import { INSECURE_MESSAGE, UNREADABLE_MESSAGE } from '@/main/secrets/secret-store'
import { fakeCrypto } from '../../../integration/core-fixture'

const P = '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE'
const C = 'spring-sale-abc234'
const C2 = 'summer-sale-def567'
const PASSWORD = 'made-up-password-for-test'

let dir = ''
afterEach(() => {
  vi.restoreAllMocks()
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
  dir = ''
})

function setUp(available = true) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-passwords-'))
  const file = path.join(dir, 'approval-passwords.bin')
  return { file, store: createPasswordStore({ file, crypto: fakeCrypto(available) }) }
}

const files = () => fs.readdirSync(dir).sort()

describe('the password store [spec/approvals.md "Kept passwords"]', () => {
  it('keeps and reads a password per project and campaign', () => {
    const { store } = setUp()
    expect(store.read(P, C)).toBeNull()
    store.keep(P, C, PASSWORD)
    store.keep(P, C2, 'another-made-up-password')
    expect(store.read(P, C)).toBe(PASSWORD)
    expect(store.read(P, C2)).toBe('another-made-up-password')
    expect(files()).toEqual(['approval-passwords.bin'])
  })

  it('keeps the passwords encrypted, under {projectId}/{campaignId}', () => {
    const { file, store } = setUp()
    store.keep(P, C, PASSWORD)
    const bytes = fs.readFileSync(file)
    expect(bytes.toString('latin1')).not.toContain(PASSWORD)
    expect(JSON.parse(fakeCrypto().decrypt(bytes))).toEqual({ [`${P}/${C}`]: PASSWORD })
  })

  it('replaces a kept password', () => {
    const { store } = setUp()
    store.keep(P, C, PASSWORD)
    store.keep(P, C, 'a-newer-made-up-password')
    expect(store.read(P, C)).toBe('a-newer-made-up-password')
  })

  it('forgets one password and keeps the others', () => {
    const { store } = setUp()
    store.keep(P, C, PASSWORD)
    store.keep(P, C2, 'another-made-up-password')
    store.forget(P, C)
    expect(store.read(P, C)).toBeNull()
    expect(store.read(P, C2)).toBe('another-made-up-password')
  })

  it('forgets a password it never kept without writing a file', () => {
    const { store } = setUp()
    store.forget(P, C)
    expect(files()).toEqual([])
  })

  it.each([
    ['bytes that do not decrypt', Buffer.from([0xff, 0x00, 0x13])],
    ['a JSON list', fakeCrypto().encrypt('["x"]')],
    ['JSON null', fakeCrypto().encrypt('null')],
  ])('never writes over a file of %s, and reads nothing from it', (_name, bytes) => {
    const { file, store } = setUp()
    fs.writeFileSync(file, bytes)
    const refused = {
      code: 'RULE_VIOLATION',
      message: UNREADABLE_MESSAGE,
      details: { reason: 'secrets_unreadable' },
    }
    expect(() => store.keep(P, C, PASSWORD)).toThrow(expect.objectContaining(refused))
    expect(() => store.forget(P, C)).toThrow(expect.objectContaining(refused))
    expect(store.read(P, C)).toBeNull()
    expect(fs.readFileSync(file)).toEqual(bytes)
    expect(files()).toEqual(['approval-passwords.bin'])
  })

  it('reads no value that is not text', () => {
    const { file, store } = setUp()
    fs.writeFileSync(file, fakeCrypto().encrypt(JSON.stringify({ [`${P}/${C}`]: 42 })))
    expect(store.read(P, C)).toBeNull()
  })

  it('does not read a password from the object prototype', () => {
    const { store } = setUp()
    store.keep(P, C, PASSWORD)
    expect(store.read('__proto__', 'x')).toBeNull()
    expect(store.read('constructor', 'x')).toBeNull()
  })

  it('refuses to keep or forget when encryption is not available, and writes nothing', () => {
    const { file, store } = setUp(false)
    const refused = {
      code: 'RULE_VIOLATION',
      message: INSECURE_MESSAGE,
      details: { reason: 'secure_storage_unavailable' },
    }
    expect(() => store.keep(P, C, PASSWORD)).toThrow(expect.objectContaining(refused))
    fs.writeFileSync(file, 'saved earlier')
    expect(() => store.forget(P, C)).toThrow(expect.objectContaining(refused))
    expect(store.read(P, C)).toBeNull()
    expect(fs.readFileSync(file, 'utf8')).toBe('saved earlier')
  })

  it('leaves no .tmp file when the write fails, and the old file as it was', () => {
    const { file, store } = setUp()
    store.keep(P, C, PASSWORD)
    const before = fs.readFileSync(file)
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('made-up rename failure')
    })
    expect(() => store.keep(P, C2, 'another-made-up-password')).toThrow()
    expect(files()).toEqual(['approval-passwords.bin'])
    expect(fs.readFileSync(file)).toEqual(before)
  })

  it('puts no password in the text of an error', () => {
    const { file, store } = setUp()
    fs.writeFileSync(file, Buffer.from([0xff]))
    try {
      store.keep(P, C, PASSWORD)
    } catch (error) {
      expect(String(error)).not.toContain(PASSWORD)
      expect(JSON.stringify(error)).not.toContain(PASSWORD)
    }
  })
})

describe('the password store says whether it can keep a password [AP-8 ruling]', () => {
  it.each([
    [true, true],
    [false, false],
  ])('canKeep is %s when encryption available is %s', (expected, available) => {
    const { store } = setUp(available)
    expect(store.canKeep()).toBe(expected)
    expect(files()).toEqual([])
  })
})
