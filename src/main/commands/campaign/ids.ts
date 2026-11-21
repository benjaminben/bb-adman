// SPEC 3.2: campaign and variant IDs. Both use six characters from one alphabet, and are
// unique inside the project; a taken ID is drawn again.
import { randomInt } from 'node:crypto'
import type Database from 'better-sqlite3'

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const SLUG_MAX = 40

function shortCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}

// Lowercase, a-z 0-9 and -, at most 40 characters. A name with none of those letters gives
// 'campaign', so the ID still has the documented shape.
export function slugOf(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '')
  return slug === '' ? 'campaign' : slug
}

function unused(db: Database.Database, table: string, make: () => string): string {
  const has = db.prepare(`SELECT 1 FROM "${table}" WHERE id = ?`)
  for (;;) {
    const id = make()
    if (has.get(id) === undefined) return id
  }
}

export function newCampaignId(db: Database.Database, name: string): string {
  const slug = slugOf(name)
  return unused(db, 'campaign', () => `${slug}-${shortCode()}`)
}

export function newVariantId(db: Database.Database): string {
  return unused(db, 'variant', shortCode)
}
