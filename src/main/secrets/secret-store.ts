// Keys live only here, in {userData}/secrets.bin: one JSON map encrypted as a whole
// (SPEC 7.7). No query returns a value; summaries carry the last four characters.
import fs from 'node:fs'
import path from 'node:path'
import { AppError } from '../../shared/schemas/result'
import { SECRET_NAMES, type SecretName, type SecretSummary } from '../../shared/schemas/secrets'

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

export function createSecretStore(opts: { file: string; crypto: SecretCrypto }) {
  function read(): Partial<Record<SecretName, string>> {
    if (!fs.existsSync(opts.file) || !opts.crypto.isAvailable()) return {}
    try {
      const parsed: unknown = JSON.parse(opts.crypto.decrypt(fs.readFileSync(opts.file)))
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<SecretName, string>)
        : {}
    } catch {
      return {}
    }
  }

  function write(map: Partial<Record<SecretName, string>>): void {
    fs.mkdirSync(path.dirname(opts.file), { recursive: true })
    const tmp = `${opts.file}.tmp`
    fs.writeFileSync(tmp, opts.crypto.encrypt(JSON.stringify(map)))
    fs.renameSync(tmp, opts.file)
  }

  return {
    get(name: SecretName): string | undefined {
      return read()[name]
    },
    set(name: SecretName, value: string): void {
      if (!opts.crypto.isAvailable()) throw new AppError('RULE_VIOLATION', INSECURE_MESSAGE)
      write({ ...read(), [name]: value })
    },
    delete(name: SecretName): void {
      const map = read()
      if (map[name] === undefined)
        throw new AppError('NOT_FOUND', 'No key is saved under that name.')
      delete map[name]
      write(map)
    },
    summaries(): SecretSummary[] {
      const map = read()
      return SECRET_NAMES.filter((n) => n !== 'mcp.token' && map[n] !== undefined).map((name) => ({
        name,
        lastFour: lastFour(map[name] ?? ''),
      }))
    },
  }
}
