// The session table: the SHA-256 of the cookie value, never the value itself.

export function addSession(
  db: D1Database,
  session: { tokenHash: string; linkId: string; expiresAt: number },
): D1PreparedStatement {
  return db
    .prepare('INSERT INTO session (token_hash, link_id, expires_at) VALUES (?, ?, ?)')
    .bind(session.tokenHash, session.linkId, session.expiresAt)
}

// A session counts only for its own link and only before its end time.
export async function hasSession(
  db: D1Database,
  tokenHash: string,
  linkId: string,
  now: number,
): Promise<boolean> {
  const sql = 'SELECT 1 FROM session WHERE token_hash = ? AND link_id = ? AND expires_at > ?'
  return (await db.prepare(sql).bind(tokenHash, linkId, now).first()) !== null
}

export function deleteSession(db: D1Database, tokenHash: string, linkId: string) {
  return db
    .prepare('DELETE FROM session WHERE token_hash = ? AND link_id = ?')
    .bind(tokenHash, linkId)
}

export function deleteLinkSessions(db: D1Database, linkId: string): D1PreparedStatement {
  return db.prepare('DELETE FROM session WHERE link_id = ?').bind(linkId)
}

export function deleteExpiredSessions(
  db: D1Database,
  linkId: string,
  now: number,
): D1PreparedStatement {
  return db.prepare('DELETE FROM session WHERE link_id = ? AND expires_at <= ?').bind(linkId, now)
}
