import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { createQueryRunner } from '../../../../src/main/queries/queries'
import { createActivityLog } from '../../../../src/main/log/activity-log'
import { AppError } from '../../../../src/shared/schemas/result'

let dir: string | undefined
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
})

function runner() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-async-query-'))
  const log = createActivityLog({ dir, minLevel: 'debug', now: () => new Date() })
  return createQueryRunner(
    {
      'test.later': async () => {
        await new Promise((r) => setTimeout(r, 1))
        return { value: 42 }
      },
      'test.refuses': async () => {
        await new Promise((r) => setTimeout(r, 1))
        throw new AppError('NOT_FOUND', 'Nothing here.')
      },
      'test.breaks': async () => {
        await new Promise((r) => setTimeout(r, 1))
        throw new Error('broken later')
      },
    },
    log,
  )
}

const user = { actor: 'user' as const }

describe('query runner awaits asynchronous queries [SPEC 4.3]', () => {
  it('returns the value an asynchronous query resolves to', async () => {
    expect(await runner()('test.later', {}, user)).toEqual({ ok: true, data: { value: 42 } })
  })

  it('returns the error an asynchronous query rejects with', async () => {
    expect(await runner()('test.refuses', {}, user)).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Nothing here.' },
    })
  })

  it('returns INTERNAL when an asynchronous query rejects with an unknown error', async () => {
    expect(await runner()('test.breaks', {}, user)).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL' },
    })
  })
})
