// F-6: the row count of every table of a project file, by name, so a "nothing changed" check
// cannot miss a table. Not a test file itself.
import type Database from 'better-sqlite3'

export function tableCounts(db: Database.Database): Record<string, number> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as Array<{ name: string }>
  return Object.fromEntries(
    tables.map((t) => [
      t.name,
      (db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get() as { n: number }).n,
    ]),
  )
}
