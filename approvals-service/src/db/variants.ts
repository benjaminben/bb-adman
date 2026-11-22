import 'server-only'
// The gallery_variant table. Every query names the link it belongs to.
import type { Db, Statement } from './client'

export type VariantRow = {
  variantKey: string
  position: number
  title: string
  sizeLine: string
  version: number
  pictureUrl: string
  pictureExpiresAt: number
  kind: 'image' | 'video'
  // All three null (an image, or a video sent as its still only), or all three set.
  clipUrl: string | null
  clipMs: number | null
  clipBytes: number | null
}

type ClipKey = 'kind' | 'clipUrl' | 'clipMs' | 'clipBytes'

// A row to write. Left out, the kind is 'image' and the clip columns are null, as the
// contract's defaults read a body without them.
export type NewVariantRow = Omit<VariantRow, ClipKey> & Partial<Pick<VariantRow, ClipKey>>

const COLUMNS = `variant_key AS variantKey, position, title, size_line AS sizeLine, version,
  picture_url AS pictureUrl, picture_expires_at AS pictureExpiresAt, kind, clip_url AS clipUrl,
  clip_ms AS clipMs, clip_bytes AS clipBytes`

export function putVariant(db: Db, linkId: string, row: NewVariantRow): Statement {
  return db
    .prepare(
      `INSERT OR REPLACE INTO gallery_variant (link_id, variant_key, position, title, size_line,
        version, picture_url, picture_expires_at, kind, clip_url, clip_ms, clip_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      row.kind ?? 'image',
      row.clipUrl ?? null,
      row.clipMs ?? null,
      row.clipBytes ?? null,
    )
}

export async function listVariants(db: Db, linkId: string): Promise<VariantRow[]> {
  const sql = `SELECT ${COLUMNS} FROM gallery_variant WHERE link_id = ? ORDER BY position`
  const { results } = await db.prepare(sql).bind(linkId).all<VariantRow>()
  return results
}

export async function findVariant(
  db: Db,
  linkId: string,
  variantKey: string,
): Promise<VariantRow | null> {
  const sql = `SELECT ${COLUMNS} FROM gallery_variant WHERE link_id = ? AND variant_key = ?`
  return db.prepare(sql).bind(linkId, variantKey).first<VariantRow>()
}

// Removes a variant from the gallery together with its sign-offs.
export function deleteVariant(db: Db, linkId: string, variantKey: string): Statement[] {
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
export function clearGallery(db: Db, linkId: string): Statement {
  return db.prepare('DELETE FROM gallery_variant WHERE link_id = ?').bind(linkId)
}

export function deleteUnlistedSignoffs(db: Db, linkId: string): Statement {
  return db
    .prepare(
      `DELETE FROM signoff WHERE link_id = ? AND variant_key NOT IN
        (SELECT variant_key FROM gallery_variant WHERE link_id = ?)`,
    )
    .bind(linkId, linkId)
}

export type Renewal = {
  variantKey: string
  version: number
  pictureUrl: string
  pictureExpiresAt: number
  // Left out: null, a renewal of a row without a clip.
  clipUrl?: string | null
}

// Changes the picture (and the clip) only when the version still matches and the renewal has a
// clip exactly when the row has one; never changes the version. So a renewal never extends the
// expiry of a clip it did not renew.
export function renewPicture(db: Db, linkId: string, renewal: Renewal): Statement {
  return db
    .prepare(
      `UPDATE gallery_variant SET picture_url = ?1, picture_expires_at = ?2, clip_url = ?3
        WHERE link_id = ?4 AND variant_key = ?5 AND version = ?6
        AND (clip_url IS NULL) = (?3 IS NULL)`,
    )
    .bind(
      renewal.pictureUrl,
      renewal.pictureExpiresAt,
      renewal.clipUrl ?? null,
      linkId,
      renewal.variantKey,
      renewal.version,
    )
}
