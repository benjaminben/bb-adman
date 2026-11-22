// The local font sharing consent list (spec/phases/phase-09.md "Font sharing consent is local",
// A-260, security class full). A project file can come from someone else, so its flag alone
// never lets a font be uploaded: consent counts only when this list, in the app's own data
// folder, holds the key {projectId}:{assetId}:{sha256}, the hash measured from the file's bytes.
// The file's place is fixed here, never taken from a project file. A damaged, oversized, linked
// or wrongly shaped file counts as empty, never as consent; it is logged by reason only. Writes
// go through {name}.partial and a rename.
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { CoreDeps } from '@/main/core-deps'
import { isUlid } from '@/shared/publish/paths'

export const FONT_CONSENT_FILE = 'font-consent.json'
export const FONT_CONSENT_MAX_KEYS = 10_000
export const FONT_CONSENT_MAX_BYTES = 1024 * 1024

const SHA256 = /^[0-9a-f]{64}$/
const ULID_PART = '[0-9A-HJKMNP-TV-Z]{26}'
const KEY = new RegExp(`^${ULID_PART}:${ULID_PART}:[0-9a-f]{64}$`)

const ConsentFile = z
  .object({
    format: z.literal(1),
    keys: z.array(z.string().regex(KEY)).max(FONT_CONSENT_MAX_KEYS),
  })
  .strict()

export type FontConsent = {
  hasConsent(projectId: string, assetId: string, sha256: string): boolean
  setConsent(projectId: string, assetId: string, sha256: string): void
  // Takes back every consent of the font, whatever its hash.
  removeConsent(projectId: string, assetId: string): void
}

type Deps = Pick<CoreDeps, 'userDataDir' | 'log'>

function keyOf(projectId: string, assetId: string, sha256: string): string | null {
  if (!isUlid(projectId) || !isUlid(assetId) || !SHA256.test(sha256)) return null
  return `${projectId}:${assetId}:${sha256}`
}

function refuse(): never {
  throw new Error('Font consent key refused')
}

export function fontConsent(deps: Deps): FontConsent {
  const file = path.join(deps.userDataDir, FONT_CONSENT_FILE)

  function unreadable(reason: string): string[] {
    deps.log.write({
      level: 'warn',
      event: 'app',
      name: 'publish.fontConsent',
      actor: 'system',
      ok: false,
      message: 'The font consent list could not be read; it counts as empty.',
      context: { reason },
    })
    return []
  }

  function load(): string[] {
    let stats: fs.Stats
    try {
      stats = fs.lstatSync(file)
    } catch {
      return []
    }
    if (!stats.isFile()) return unreadable('font_consent_not_a_file')
    if (stats.size > FONT_CONSENT_MAX_BYTES) return unreadable('font_consent_too_large')
    try {
      const bytes = fs.readFileSync(file)
      if (bytes.byteLength > FONT_CONSENT_MAX_BYTES) return unreadable('font_consent_too_large')
      const parsed = ConsentFile.safeParse(JSON.parse(bytes.toString('utf8')))
      return parsed.success ? parsed.data.keys : unreadable('font_consent_unreadable')
    } catch {
      return unreadable('font_consent_unreadable')
    }
  }

  // A link at the .partial name is refused, so nothing is written through it. The rename
  // replaces whatever is at the file's name (a link included) and never writes through it.
  function save(keys: string[]): void {
    fs.mkdirSync(deps.userDataDir, { recursive: true })
    const partial = `${file}.partial`
    const old = fs.lstatSync(partial, { throwIfNoEntry: false })
    if (old?.isSymbolicLink() || (old && !old.isFile())) refuse()
    if (old) fs.rmSync(partial)
    const body = JSON.stringify({ format: 1, keys: ConsentFile.parse({ format: 1, keys }).keys })
    try {
      fs.writeFileSync(partial, body, { flag: 'wx' })
      fs.renameSync(partial, file)
    } catch (error) {
      fs.rmSync(partial, { force: true })
      throw error
    }
  }

  const prefixOf = (projectId: string, assetId: string) => `${projectId}:${assetId}:`

  return {
    hasConsent(projectId, assetId, sha256) {
      const key = keyOf(projectId, assetId, sha256)
      return key !== null && load().includes(key)
    },
    setConsent(projectId, assetId, sha256) {
      const key = keyOf(projectId, assetId, sha256) ?? refuse()
      // One key per font: a changed file needs a new consent, so the old hash goes.
      const kept = load().filter((k) => !k.startsWith(prefixOf(projectId, assetId)))
      save([...kept, key].slice(-FONT_CONSENT_MAX_KEYS))
    },
    removeConsent(projectId, assetId) {
      if (!isUlid(projectId) || !isUlid(assetId)) refuse()
      const keys = load()
      const kept = keys.filter((k) => !k.startsWith(prefixOf(projectId, assetId)))
      if (kept.length !== keys.length) save(kept)
    },
  }
}
