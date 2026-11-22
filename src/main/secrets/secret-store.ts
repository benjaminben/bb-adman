// Keys live only here, in {userData}/secrets.bin: one JSON map encrypted as a whole
// (SPEC 7.7). Summaries carry the last four characters; values stay in the main process.
import fs from 'node:fs'
import path from 'node:path'
import { AppError } from '@/shared/schemas/result'
import {
  SECRET_NAMES,
  SIGN_IN_SECRET_NAMES,
  type SecretName,
  type SecretSummary,
} from '@/shared/schemas/secrets'

export type SecretCrypto = {
  isAvailable(): boolean
  encrypt(text: string): Buffer
  decrypt(data: Buffer): string
}

export type SecretStore = ReturnType<typeof createSecretStore>

export const INSECURE_MESSAGE = 'This computer cannot store keys securely.'

// A key of four characters or fewer would be shown whole, so nothing is shown.
export function lastFour(value: string): string {
  return value.length > 4 ? value.slice(-4) : ''
}

// FN-1: set and delete refuse rather than write a new file over saved keys they cannot read.
export const UNREADABLE_MESSAGE =
  'Saved keys could not be read, so no key was changed. They are left as they were.'

type SecretMap = Partial<Record<SecretName, string>>

export function createSecretStore(opts: { file: string; crypto: SecretCrypto }) {
  // `null` means the file exists but does not decrypt to a JSON object.
  function load(): SecretMap | null {
    if (!fs.existsSync(opts.file) || !opts.crypto.isAvailable()) return {}
    try {
      const parsed: unknown = JSON.parse(opts.crypto.decrypt(fs.readFileSync(opts.file)))
      const isMap = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      return isMap ? (parsed as SecretMap) : null
    } catch {
      return null
    }
  }

  // Reading for display: an unreadable file shows as nothing saved.
  function read(): SecretMap {
    return load() ?? {}
  }

  function readForChange(): SecretMap {
    const map = load()
    if (map === null) {
      throw new AppError('RULE_VIOLATION', UNREADABLE_MESSAGE, { reason: 'secrets_unreadable' })
    }
    return map
  }

  function write(map: SecretMap): void {
    fs.mkdirSync(path.dirname(opts.file), { recursive: true })
    const tmp = `${opts.file}.tmp`
    fs.writeFileSync(tmp, opts.crypto.encrypt(JSON.stringify(map)))
    fs.renameSync(tmp, opts.file)
  }

  return {
    // P9-1: whether a secret could be saved now, so a sign-in refuses before anything opens.
    canStore(): boolean {
      return opts.crypto.isAvailable()
    },
    get(name: SecretName): string | undefined {
      return read()[name]
    },
    set(name: SecretName, value: string): void {
      if (!opts.crypto.isAvailable()) {
        throw new AppError('RULE_VIOLATION', INSECURE_MESSAGE, {
          reason: 'secure_storage_unavailable',
        })
      }
      write({ ...readForChange(), [name]: value })
    },
    delete(name: SecretName): void {
      const map = readForChange()
      if (map[name] === undefined)
        throw new AppError('NOT_FOUND', 'No key is saved under that name.')
      delete map[name]
      write(map)
    },
    summaries(): SecretSummary[] {
      const map = read()
      // Every secret, mcp.token included, is listed by its last four characters only. A
      // sign-in secret shows none (A-211): the window learns only that it exists.
      return SECRET_NAMES.filter((n) => map[n] !== undefined).map((name) => ({
        name,
        lastFour: SIGN_IN_SECRET_NAMES.includes(name) ? '' : lastFour(map[name] ?? ''),
      }))
    },
  }
}
