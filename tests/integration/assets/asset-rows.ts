// Test helper for slice A: an asset row with chosen paths and values. Not a test file itself.
import type Database from 'better-sqlite3'

export type TestAsset = {
  id: string
  relPath: string
  absPath: string
  kind?: 'image' | 'video' | 'font' | 'text'
  library?: 'reference' | 'asset'
  storage?: 'linked' | 'managed'
  mime?: string
  subjectId?: string | null
  contentHash?: string
}

export function insertTestAsset(db: Database.Database, a: TestAsset): void {
  db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name, abs_path,
      rel_path, mime, byte_size, mtime_ms, content_hash, font_publish_allowed, created_at)
     VALUES (?, ?, ?, 'imported', ?, ?, ?, ?, ?, ?, 1, 1, ?, 0, '2026-11-20T10:00:00.000Z')`,
  ).run(
    a.id,
    a.library ?? 'asset',
    a.kind ?? 'image',
    a.storage ?? 'linked',
    a.subjectId ?? null,
    `${a.id}.png`,
    a.absPath,
    a.relPath,
    a.mime ?? 'image/png',
    a.contentHash ?? `hash-${a.id}`,
  )
}
