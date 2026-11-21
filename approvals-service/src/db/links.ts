// The link table (spec/approvals-service.md "Database (D1)"). Every statement binds its values.
// Write functions return statements, so a caller can run one or put several in one batch.
import type { StoredPassword } from '../crypto/password'

export type LinkRow = {
  id: string
  slug: string
  projectId: string
  campaignId: string
  campaignName: string
  password: StoredPassword
  createdAt: number
}

type LinkRecord = Omit<LinkRow, 'password'> & {
  passwordHash: string
  passwordSalt: string
  passwordIterations: number
}

const COLUMNS = `id, slug, project_id AS projectId, campaign_id AS campaignId,
  campaign_name AS campaignName, password_hash AS passwordHash, password_salt AS passwordSalt,
  password_iterations AS passwordIterations, created_at AS createdAt`

function toRow(record: LinkRecord | null): LinkRow | null {
  if (record === null) return null
  const { passwordHash, passwordSalt, passwordIterations, ...rest } = record
  return {
    ...rest,
    password: { hash: passwordHash, salt: passwordSalt, iterations: passwordIterations },
  }
}

export function insertLink(db: D1Database, link: LinkRow): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO link (id, slug, project_id, campaign_id, campaign_name, password_hash,
        password_salt, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      link.id,
      link.slug,
      link.projectId,
      link.campaignId,
      link.campaignName,
      link.password.hash,
      link.password.salt,
      link.password.iterations,
      link.createdAt,
    )
}

export async function findLinkByPair(
  db: D1Database,
  projectId: string,
  campaignId: string,
): Promise<LinkRow | null> {
  const sql = `SELECT ${COLUMNS} FROM link WHERE project_id = ? AND campaign_id = ?`
  return toRow(await db.prepare(sql).bind(projectId, campaignId).first<LinkRecord>())
}

export async function findLinkBySlug(db: D1Database, slug: string): Promise<LinkRow | null> {
  const sql = `SELECT ${COLUMNS} FROM link WHERE slug = ?`
  return toRow(await db.prepare(sql).bind(slug).first<LinkRecord>())
}

export function setCampaignName(db: D1Database, linkId: string, name: string): D1PreparedStatement {
  return db.prepare('UPDATE link SET campaign_name = ? WHERE id = ?').bind(name, linkId)
}

// A new password: new hash and salt, and the wrong-password count starts again.
export function setLinkPassword(
  db: D1Database,
  linkId: string,
  password: StoredPassword,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE link SET password_hash = ?, password_salt = ?, password_iterations = ?,
        tries = 0, tries_since = NULL WHERE id = ?`,
    )
    .bind(password.hash, password.salt, password.iterations, linkId)
}

// Children first, in one batch: a batch is one transaction, so a failure removes nothing.
export async function deleteLink(db: D1Database, linkId: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM session WHERE link_id = ?').bind(linkId),
    db.prepare('DELETE FROM signoff WHERE link_id = ?').bind(linkId),
    db.prepare('DELETE FROM gallery_variant WHERE link_id = ?').bind(linkId),
    db.prepare('DELETE FROM link WHERE id = ?').bind(linkId),
  ])
}
