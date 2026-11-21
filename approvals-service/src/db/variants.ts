// The gallery_variant table. Every query names the link it belongs to.

export type VariantRow = {
  variantKey: string
  position: number
  title: string
  sizeLine: string
  version: number
  pictureUrl: string
  pictureExpiresAt: number
}

const COLUMNS = `variant_key AS variantKey, position, title, size_line AS sizeLine, version,
  picture_url AS pictureUrl, picture_expires_at AS pictureExpiresAt`

export function putVariant(db: D1Database, linkId: string, row: VariantRow): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR REPLACE INTO gallery_variant (link_id, variant_key, position, title, size_line,
        version, picture_url, picture_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      linkId,
      row.variantKey,
      row.position,
      row.title,
      row.sizeLine,
      row.version,
      row.pictureUrl,
      row.pictureExpiresAt,
    )
}

export async function listVariants(db: D1Database, linkId: string): Promise<VariantRow[]> {
  const sql = `SELECT ${COLUMNS} FROM gallery_variant WHERE link_id = ? ORDER BY position`
  const { results } = await db.prepare(sql).bind(linkId).all<VariantRow>()
  return results
}

export async function findVariant(
  db: D1Database,
  linkId: string,
  variantKey: string,
): Promise<VariantRow | null> {
  const sql = `SELECT ${COLUMNS} FROM gallery_variant WHERE link_id = ? AND variant_key = ?`
  return db.prepare(sql).bind(linkId, variantKey).first<VariantRow>()
}

// Removes a variant from the gallery together with its sign-offs.
export function deleteVariant(
  db: D1Database,
  linkId: string,
  variantKey: string,
): D1PreparedStatement[] {
  return [
    db
      .prepare('DELETE FROM signoff WHERE link_id = ? AND variant_key = ?')
      .bind(linkId, variantKey),
    db
      .prepare('DELETE FROM gallery_variant WHERE link_id = ? AND variant_key = ?')
      .bind(linkId, variantKey),
  ]
}

// The first and last statements of a gallery replace: every row of the link goes, the listed
// rows are written again between the two, then the sign-offs of every variant no longer listed
// go. Sign-offs of a listed variant stay, whatever their version.
export function clearGallery(db: D1Database, linkId: string): D1PreparedStatement {
  return db.prepare('DELETE FROM gallery_variant WHERE link_id = ?').bind(linkId)
}

export function deleteUnlistedSignoffs(db: D1Database, linkId: string): D1PreparedStatement {
  return db
    .prepare(
      `DELETE FROM signoff WHERE link_id = ? AND variant_key NOT IN
        (SELECT variant_key FROM gallery_variant WHERE link_id = ?)`,
    )
    .bind(linkId, linkId)
}

// Changes the picture only when the version still matches; never changes the version.
export function renewPicture(
  db: D1Database,
  linkId: string,
  renewal: { variantKey: string; version: number; pictureUrl: string; pictureExpiresAt: number },
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE gallery_variant SET picture_url = ?, picture_expires_at = ?
        WHERE link_id = ? AND variant_key = ? AND version = ?`,
    )
    .bind(renewal.pictureUrl, renewal.pictureExpiresAt, linkId, renewal.variantKey, renewal.version)
}
