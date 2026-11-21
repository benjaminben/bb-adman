import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Storage is kept apart per test file, so each file starts from the migrated, empty database.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
