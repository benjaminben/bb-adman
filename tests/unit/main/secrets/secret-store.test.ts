import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createSecretStore,
  UNREADABLE_MESSAGE,
  type SecretCrypto,
} from '@/main/secrets/secret-store'
import { AppError } from '@/shared/schemas/result'

// A stand-in for safeStorage: base64 in place of encryption.
function fakeCrypto(decrypt?: (data: Buffer) => string): SecretCrypto {
  return {
    isAvailable: () => true,
    encrypt: (text) => Buffer.from(Buffer.from(text).toString('base64')),
    decrypt: decrypt ?? ((data) => Buffer.from(data.toString(), 'base64').toString()),
  }
}

let dir: string
let file: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-secrets-'))
  file = path.join(dir, 'secrets.bin')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function refusalOf(action: () => void): AppError {
  try {
    action()
  } catch (error) {
    if (error instanceof AppError) return error
    throw error
  }
  throw new Error('the call was not refused')
}

describe('the secret store keeps and removes keys [SPEC 7.7]', () => {
  it('saves a key next to the others and removes one by name', () => {
    const store = createSecretStore({ file, crypto: fakeCrypto() })
    store.set('gemini.apiKey', 'key-one-1111')
    store.set('fal.apiKey', 'key-two-2222')
    expect(store.get('gemini.apiKey')).toBe('key-one-1111')
    store.delete('gemini.apiKey')
    expect(store.get('gemini.apiKey')).toBeUndefined()
    expect(store.get('fal.apiKey')).toBe('key-two-2222')
  })
})

describe('an unreadable key file is never written over [FN-1]', () => {
  const throwing = fakeCrypto(() => {
    throw new Error('the keychain entry changed')
  })

  it('refuses set when the file exists but cannot be decrypted, and keeps its bytes', () => {
    fs.writeFileSync(file, 'saved bytes the app cannot read')
    const before = fs.readFileSync(file)
    const store = createSecretStore({ file, crypto: throwing })
    const error = refusalOf(() => store.set('gemini.apiKey', 'new-key-9999'))
    expect(error.code).toBe('RULE_VIOLATION')
    expect(error.message).toBe(UNREADABLE_MESSAGE)
    expect(fs.readFileSync(file).equals(before)).toBe(true)
    expect(fs.existsSync(`${file}.tmp`)).toBe(false)
  })

  it('refuses delete on the same file, and keeps its bytes', () => {
    fs.writeFileSync(file, 'saved bytes the app cannot read')
    const before = fs.readFileSync(file)
    const store = createSecretStore({ file, crypto: throwing })
    const error = refusalOf(() => store.delete('gemini.apiKey'))
    expect(error.message).toBe(UNREADABLE_MESSAGE)
    expect(fs.readFileSync(file).equals(before)).toBe(true)
  })

  it.each([['[]'], ['"x"'], ['null'], ['3'], ['{not json']])(
    'refuses set and delete when the file decrypts to %s',
    (text) => {
      fs.writeFileSync(file, Buffer.from(text).toString('base64'))
      const before = fs.readFileSync(file)
      const store = createSecretStore({ file, crypto: fakeCrypto() })
      expect(refusalOf(() => store.set('gemini.apiKey', 'new-key-9999')).message).toBe(
        UNREADABLE_MESSAGE,
      )
      expect(refusalOf(() => store.delete('gemini.apiKey')).message).toBe(UNREADABLE_MESSAGE)
      expect(fs.readFileSync(file).equals(before)).toBe(true)
    },
  )

  it('still reports nothing saved through get and summaries', () => {
    fs.writeFileSync(file, 'saved bytes the app cannot read')
    const store = createSecretStore({ file, crypto: throwing })
    expect(store.get('gemini.apiKey')).toBeUndefined()
    expect(store.summaries()).toEqual([])
  })

  it('the refusal is one fixed sentence that names no file, path or key', () => {
    expect(UNREADABLE_MESSAGE).toBe(
      'Saved keys could not be read, so no key was changed. They are left as they were.',
    )
  })
})
