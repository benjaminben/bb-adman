// spec/approvals-service.md "The port": one migrated in-memory database per test file. Vitest
// loads modules apart per file, so each file starts from the empty, migrated schema.
import { createClient } from '@libsql/client'
import { migrate, MIGRATIONS } from '../scripts/migrate'
import { createDb } from '../src/db/client'

const client = createClient({ url: ':memory:', intMode: 'number' })
await migrate(client, MIGRATIONS)

export const db = createDb(client)
