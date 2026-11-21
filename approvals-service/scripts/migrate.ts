// spec/approvals-service.md "Database", "Migrations": applies migrations/*.sql in name order,
// each file and its record in one batch. Run by Node's own type stripping (`npm run db:migrate`),
// so it uses only plain TypeScript and does not load src/ (that code is marked server-only).
// A hosted address is refused unless `--hosted` is given; only the stakeholder passes it.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type Client } from '@libsql/client'

export const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url))

const LOCAL_DEFAULT = 'file:local.db'

export function isLocalAddress(url: string): boolean {
  return url === ':memory:' || url.startsWith('file:')
}

type Source = Record<string, string | undefined>

// The address and token to use. Throws, naming no value, when a hosted address is not allowed.
export function chooseAddress(source: Source, args: string[]) {
  const url = source.TURSO_DATABASE_URL || LOCAL_DEFAULT
  if (!isLocalAddress(url) && !args.includes('--hosted')) {
    const refused = new Error(
      'refused: the database address is not a local file (pass --hosted to allow)',
    )
    refused.name = 'Refused'
    throw refused
  }
  return { url, authToken: source.TURSO_AUTH_TOKEN || undefined }
}

// The statements of one file: `--` comment lines dropped, split on `;`. The migrations hold no
// `;` or `--` inside a text value.
function statementsOf(sql: string): string[] {
  const text = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  return text
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

// The names of the files applied by this run.
export async function migrate(client: Client, folder: string, now = Date.now): Promise<string[]> {
  await client.execute(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  )
  const done = await client.execute('SELECT name FROM schema_migrations')
  const applied = new Set(done.rows.map((row) => String(row[0])))
  const names = readdirSync(folder)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  const ran: string[] = []
  for (const name of names) {
    if (applied.has(name)) continue
    const record = {
      sql: 'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
      args: [name, now()],
    }
    await client.batch([...statementsOf(readFileSync(join(folder, name), 'utf8')), record], 'write')
    ran.push(name)
  }
  return ran
}

async function main() {
  const address = chooseAddress(process.env, process.argv.slice(2))
  const client = createClient({ ...address, intMode: 'number' })
  const ran = await migrate(client, MIGRATIONS)
  client.close()
  process.stdout.write(ran.length === 0 ? 'Nothing to apply.\n' : `Applied: ${ran.join(', ')}\n`)
}

// A fixed line. A failure's own message may quote the address or its token, so only its code or
// name is shown, and only when it is a plain word.
function failureLine(error: unknown): string {
  if (error instanceof Error && error.name === 'Refused') return error.message
  const code = error instanceof Error && 'code' in error ? error.code : undefined
  const name = error instanceof Error ? error.name : undefined
  const label = [code, name].find((v) => typeof v === 'string' && /^[A-Za-z_]{1,40}$/.test(v))
  return `Migration failed (${label ?? 'unknown'}).`
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`${failureLine(error)}\n`)
    process.exitCode = 1
  })
}
