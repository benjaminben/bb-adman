import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { afterAll, describe, expect, it } from 'vitest'
import { migrate, MIGRATIONS } from '../scripts/migrate'

// AP-14 review fix 1: the migrate script never prints the database address or its token, only
// fixed lines and an error's code or name. Run as the stakeholder runs it: `node scripts/migrate.ts`.

const SCRIPT = fileURLToPath(new URL('../scripts/migrate.ts', import.meta.url))
const SECRET = 'made-up-secret-7f3a'
const TOKEN = 'made-up-token-91c2'
const folder = mkdtempSync(join(tmpdir(), 'adman-migrate-'))
afterAll(() => rmSync(folder, { recursive: true, force: true }))

function run(env: Record<string, string>, args: string[] = []) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', ...env },
    encoding: 'utf8',
  })
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}

describe('scripts/migrate.ts prints no address or token [AP-14 review]', () => {
  // Each address is refused by the libSQL client while it is being made, before any connection;
  // the client's own message would quote a part of it.
  it.each([
    `libsql://db.example?tls=${SECRET}&authToken=${TOKEN}`,
    `nonsense://${SECRET}.example?authToken=${TOKEN}`,
    `libsql://db.example?${SECRET}=1&authToken=${TOKEN}`,
  ])('a malformed hosted address %#', (url) => {
    const { status, out } = run({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: TOKEN }, ['--hosted'])
    expect(status).toBe(1)
    expect(out).not.toContain(SECRET)
    expect(out).not.toContain(TOKEN)
    expect(out).not.toContain('db.example')
    expect(out).toMatch(/^Migration failed \(URL_[A-Z_]+\)\.\n$/)
  })

  it('a hosted address without --hosted', () => {
    const url = `libsql://${SECRET}.example?authToken=${TOKEN}`
    const { status, out } = run({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: TOKEN })
    expect(status).toBe(1)
    expect(out).not.toContain(SECRET)
    expect(out).not.toContain(TOKEN)
  })

  it('a local file: the names of the applied files only', () => {
    const url = `file:${join(folder, `${SECRET}.db`)}`
    expect(run({ TURSO_DATABASE_URL: url })).toEqual({
      status: 0,
      out: 'Applied: 0001_init.sql, 0002_clips.sql\n',
    })
    expect(run({ TURSO_DATABASE_URL: url })).toEqual({ status: 0, out: 'Nothing to apply.\n' })
  })
})

// spec/phases/round-2-approvals-video.md "Contract and data changes" (R2V-1): 0002_clips.sql adds
// the kind and the three clip columns. Only in-memory databases here; nothing hosted.
describe('migrations/0002_clips.sql [R2V-1]', () => {
  const COLUMNS = 'SELECT variant_key, kind, clip_url, clip_ms, clip_bytes FROM gallery_variant'

  it('applies both files in order on an empty database', async () => {
    const client = createClient({ url: ':memory:', intMode: 'number' })
    expect(await migrate(client, MIGRATIONS)).toEqual(['0001_init.sql', '0002_clips.sql'])
    expect((await client.execute(COLUMNS)).rows).toEqual([])
    expect(await migrate(client, MIGRATIONS)).toEqual([])
  })

  it('applies 0002 alone on a database holding 0001 with rows, which read as images', async () => {
    const first = join(folder, 'first-only')
    mkdirSync(first)
    copyFileSync(join(MIGRATIONS, '0001_init.sql'), join(first, '0001_init.sql'))
    const client = createClient({ url: ':memory:', intMode: 'number' })
    expect(await migrate(client, first)).toEqual(['0001_init.sql'])
    await client.execute(
      `INSERT INTO gallery_variant (link_id, variant_key, position, title, size_line, version,
        picture_url, picture_expires_at) VALUES ('l', 'abc234', 0, 'T', 'S', 1, 'https://p', 5)`,
    )
    expect(await migrate(client, MIGRATIONS)).toEqual(['0002_clips.sql'])
    const rows = (await client.execute(COLUMNS)).rows.map((row) => ({ ...row }))
    expect(rows).toEqual([
      { variant_key: 'abc234', kind: 'image', clip_url: null, clip_ms: null, clip_bytes: null },
    ])
  })
})
