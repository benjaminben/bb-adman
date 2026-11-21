import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

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
    expect(run({ TURSO_DATABASE_URL: url })).toEqual({ status: 0, out: 'Applied: 0001_init.sql\n' })
    expect(run({ TURSO_DATABASE_URL: url })).toEqual({ status: 0, out: 'Nothing to apply.\n' })
  })
})
