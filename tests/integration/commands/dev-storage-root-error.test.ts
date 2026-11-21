import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeDevFixture, type DevFixture } from './dev-fixture'
import { devStorage } from '@/main/commands/dev/storage'
import type { AppError } from '@/shared/schemas/result'

let f: DevFixture
afterEach(() => f.cleanup())

// Every path under the fixture root, the log folder left out (every command writes there).
function tree(): string[] {
  const logs = path.join(f.userData, 'logs')
  return fs
    .readdirSync(f.root, { recursive: true, withFileTypes: true })
    .map((d) => path.join(d.parentPath, d.name))
    .filter((p) => p !== logs && !p.startsWith(logs + path.sep))
    .sort()
}

describe('dev.storage when lstat of the local root fails [SPEC 4.2 1.22, 14 M8]', () => {
  it('answers PROVIDER_ERROR kind other for ENOTDIR, logs the code and makes nothing', async () => {
    f = makeDevFixture()
    const parent = path.join(f.root, 'parent-is-a-file')
    fs.writeFileSync(parent, 'not a folder')
    const before = tree()
    const command = devStorage({ ...f.core.deps, userDataDir: parent })
    const parsed = command.parse({ storage: 'local', action: 'list' })
    if (!parsed.ok) throw new Error('input refused')
    const ctx = { actor: 'user' as const, commandId: 'c1' }
    const reply = await Promise.resolve()
      .then(() => command.run(ctx, parsed.input))
      .then(
        () => null,
        (error: AppError) => error.toBody(),
      )
    expect(reply?.code).toBe('PROVIDER_ERROR')
    expect(reply?.details).toEqual({ provider: 'local', kind: 'other' })
    expect(JSON.stringify(reply)).not.toContain('ENOTDIR')
    expect(f.readLogs()).toContain('ENOTDIR')
    expect(fs.readFileSync(parent, 'utf8')).toBe('not a folder')
    expect(tree()).toEqual(before)
  })
})
