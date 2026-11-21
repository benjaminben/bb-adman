// The kept passwords (spec/approvals.md "Kept passwords", A-85, security class). One JSON map
// from `{projectId}/{campaignId}` to the password, encrypted as a whole with the SecretCrypto of
// secrets.bin, and the secret store's rules: no saving without encryption, a file that cannot be
// read is never written over, and every write goes through a .tmp file and a rename. No error
// text holds a password.
import fs from 'node:fs'
import path from 'node:path'
import {
  INSECURE_MESSAGE,
  UNREADABLE_MESSAGE,
  type SecretCrypto,
} from '@/main/secrets/secret-store'
import { AppError } from '@/shared/schemas/result'
import type { PasswordStore } from './types'

export type PasswordStoreOptions = { file: string; crypto: SecretCrypto }

type PasswordMap = Record<string, unknown>

const keyOf = (projectId: string, campaignId: string) => `${projectId}/${campaignId}`

export function createPasswordStore(opts: PasswordStoreOptions): PasswordStore {
  // null: the file exists but does not decrypt to a JSON object.
  function load(): PasswordMap | null {
    if (!fs.existsSync(opts.file)) return {}
    try {
      const parsed: unknown = JSON.parse(opts.crypto.decrypt(fs.readFileSync(opts.file)))
      const isMap = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      return isMap ? (parsed as PasswordMap) : null
    } catch {
      return null
    }
  }

  function loadForChange(): PasswordMap {
    if (!opts.crypto.isAvailable()) {
      throw new AppError('RULE_VIOLATION', INSECURE_MESSAGE, {
        reason: 'secure_storage_unavailable',
      })
    }
    const map = load()
    if (map === null) {
      throw new AppError('RULE_VIOLATION', UNREADABLE_MESSAGE, { reason: 'secrets_unreadable' })
    }
    return map
  }

  function write(map: PasswordMap): void {
    fs.mkdirSync(path.dirname(opts.file), { recursive: true })
    const tmp = `${opts.file}.tmp`
    try {
      fs.writeFileSync(tmp, opts.crypto.encrypt(JSON.stringify(map)))
      fs.renameSync(tmp, opts.file)
    } catch (error) {
      fs.rmSync(tmp, { force: true })
      throw error
    }
  }

  return {
    canKeep: () => opts.crypto.isAvailable(),
    keep(projectId, campaignId, password) {
      write({ ...loadForChange(), [keyOf(projectId, campaignId)]: password })
    },
    read(projectId, campaignId) {
      if (!opts.crypto.isAvailable()) return null
      const map = load() ?? {}
      const key = keyOf(projectId, campaignId)
      const value = Object.hasOwn(map, key) ? map[key] : null
      return typeof value === 'string' ? value : null
    },
    forget(projectId, campaignId) {
      if (!fs.existsSync(opts.file)) return
      const map = loadForChange()
      const key = keyOf(projectId, campaignId)
      if (!Object.hasOwn(map, key)) return
      delete map[key]
      write(map)
    },
  }
}
