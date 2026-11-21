// Inserts whole rows into a project file for tests. Not a test file itself.
import type Database from 'better-sqlite3'

// SPEC 6.1: the stored brief is a Brief (SPEC 14 step 0 remainder R3).
export const VALID_BRIEF = {
  campaignName: 'Summer',
  region: 'US',
  audience: 'All',
  message: 'Hello',
  subjects: [{ name: 'Bottle' }],
}

export function insertCampaign(
  db: Database.Database,
  id: string,
  over: { languages?: string } = {},
): void {
  db.prepare(
    `INSERT INTO campaign (id, name, region, audience, message, primary_language, languages,
      sizes, template_id, brief, created_by, created_at)
     VALUES (?, 'Summer', 'US', 'All', 'Hello', 'en-US', ?, '[]', 't1', ?, 'user', 'x')`,
  ).run(id, over.languages ?? '["en-US"]', JSON.stringify(VALID_BRIEF))
}

export function insertAsset(
  db: Database.Database,
  row: { id: string; subjectId?: string; fontPublishAllowed?: number },
): void {
  db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name, abs_path,
      rel_path, mime, byte_size, mtime_ms, content_hash, font_publish_allowed, created_at)
     VALUES (?, 'asset', 'image', 'imported', 'linked', ?, ?, '/x', 'x', 'image/png', 10, 1,
      'h', ?, 'x')`,
  ).run(row.id, row.subjectId ?? null, `${row.id}.png`, row.fontPublishAllowed ?? 0)
}
