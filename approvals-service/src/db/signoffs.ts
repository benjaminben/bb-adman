import 'server-only'
// The signoff table. Every query names the link it belongs to.
import type { Db, Statement } from './client'

export type SignoffRow = {
  id: string
  variantKey: string
  version: number
  email: string
  createdAt: number
}

// A repeat of the same email for the same variant and version adds nothing.
export function addSignoff(db: Db, linkId: string, row: SignoffRow): Statement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO signoff (id, link_id, variant_key, version, email, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, linkId, row.variantKey, row.version, row.email, row.createdAt)
}

// A visitor's sign-off (spec/approvals-service-visitor.md "Forms that write"): written only while
// the variant still exists for this link at this version, in one statement, so a variant changed
// or removed between page and post gets no row.
export function addSignoffIfVariant(db: Db, linkId: string, row: SignoffRow): Statement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO signoff (id, link_id, variant_key, version, email, created_at)
        SELECT ?1, link_id, variant_key, version, ?2, ?3
        FROM gallery_variant WHERE link_id = ?4 AND variant_key = ?5 AND version = ?6`,
    )
    .bind(row.id, row.email, row.createdAt, linkId, row.variantKey, row.version)
}

export async function hasSignoff(
  db: Db,
  linkId: string,
  key: { variantKey: string; version: number; email: string },
): Promise<boolean> {
  const sql = `SELECT 1 AS found FROM signoff
    WHERE link_id = ? AND variant_key = ? AND version = ? AND email = ?`
  const found = await db.prepare(sql).bind(linkId, key.variantKey, key.version, key.email).first()
  return found !== null
}

// Oldest first.
export async function listSignoffs(db: Db, linkId: string): Promise<SignoffRow[]> {
  const sql = `SELECT id, variant_key AS variantKey, version, email, created_at AS createdAt
    FROM signoff WHERE link_id = ? ORDER BY created_at, id`
  const { results } = await db.prepare(sql).bind(linkId).all<SignoffRow>()
  return results
}

// An ID of another link removes nothing.
export function removeSignoff(db: Db, linkId: string, id: string): Statement {
  return db.prepare('DELETE FROM signoff WHERE id = ? AND link_id = ?').bind(id, linkId)
}

// The same statement for a visitor's Remove, giving back the removed row's variant key (or null),
// so the reply can go back to that variant.
export async function removeSignoffOf(db: Db, linkId: string, id: string): Promise<string | null> {
  const sql = 'DELETE FROM signoff WHERE id = ? AND link_id = ? RETURNING variant_key AS variantKey'
  return db.prepare(sql).bind(id, linkId).first<string>('variantKey')
}
