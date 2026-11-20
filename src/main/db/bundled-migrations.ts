// Loads the drizzle-kit migrations in src/main/db/migrations/ into the app bundle.
// The app's schema version is the number of migrations it carries (SPEC 3.8).
import journal from './migrations/meta/_journal.json'

export type Migration = { tag: string; statements: string[] }

const files = import.meta.glob<string>('./migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const bundledMigrations: Migration[] = journal.entries.map((entry) => {
  const sql = files[`./migrations/${entry.tag}.sql`]
  if (sql === undefined) throw new Error(`Migration file missing: ${entry.tag}`)
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return { tag: entry.tag, statements }
})
