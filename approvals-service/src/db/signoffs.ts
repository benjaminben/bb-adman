// The signoff table. Every query names the link it belongs to.

export type SignoffRow = {
  id: string
  variantKey: string
  version: number
  email: string
  createdAt: number
}

// A repeat of the same email for the same variant and version adds nothing.
export function addSignoff(db: D1Database, linkId: string, row: SignoffRow): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO signoff (id, link_id, variant_key, version, email, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.id, linkId, row.variantKey, row.version, row.email, row.createdAt)
}

// Oldest first.
export async function listSignoffs(db: D1Database, linkId: string): Promise<SignoffRow[]> {
  const sql = `SELECT id, variant_key AS variantKey, version, email, created_at AS createdAt
    FROM signoff WHERE link_id = ? ORDER BY created_at, id`
  const { results } = await db.prepare(sql).bind(linkId).all<SignoffRow>()
  return results
}

// An ID of another link removes nothing.
export function removeSignoff(db: D1Database, linkId: string, id: string): D1PreparedStatement {
  return db.prepare('DELETE FROM signoff WHERE id = ? AND link_id = ?').bind(id, linkId)
}
