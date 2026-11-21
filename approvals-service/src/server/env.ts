import 'server-only'
// spec/approvals-service.md "Environment": the one place that reads the process environment.
// It is read on each request; the database client is made on first use and kept.
import { openDb, type Db } from '../db/client'
import type { Env } from '../env'

type Source = Record<string, string | undefined>

function notSetUp(): Error {
  const error = new Error('The database is not set up.')
  error.name = 'NotSetUp'
  return error
}

// Stands in when there is no usable address: every use fails with a fixed error that names no
// value, so a visitor route answers the fixed 500.
const NO_DATABASE: Db = {
  prepare() {
    throw notSetUp()
  },
  async batch() {
    throw notSetUp()
  },
}

let kept: { url: string; authToken: string | undefined; db: Db } | null = null

function databaseOf(url: string, authToken: string | undefined): Db | null {
  if (kept !== null && kept.url === url && kept.authToken === authToken) return kept.db
  try {
    kept = { url, authToken, db: openDb(url, authToken) }
  } catch {
    // A malformed address: the client's own message would quote it, so it is not passed on.
    return null
  }
  return kept.db
}

export function loadEnv(source: Source = process.env): Env {
  // Vercel sets VERCEL on every deployment, so the test origin never takes effect there.
  const testOrigin = source.VERCEL === undefined ? source.TEST_PICTURE_ORIGIN : undefined
  const url = source.TURSO_DATABASE_URL
  const db = url ? databaseOf(url, source.TURSO_AUTH_TOKEN || undefined) : null
  // No database: the key counts as missing too, so the API answers 503 not_set_up.
  if (db === null) return { DB: NO_DATABASE, TEST_PICTURE_ORIGIN: testOrigin }
  return { DB: db, API_KEY: source.API_KEY, TEST_PICTURE_ORIGIN: testOrigin }
}
