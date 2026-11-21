import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { createCore, type Core } from '@/main/core'
import { fakeCrypto } from '../core-fixture'
import type { AppState } from '@/shared/schemas/queries/app'

let core: Core | null = null
let root = ''
afterEach(() => {
  core?.closeAll()
  core = null
  fs.rmSync(root, { recursive: true, force: true })
})

async function stateWith(devTools?: boolean): Promise<AppState> {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-state-dev-'))
  core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: path.join(root, 'Documents'),
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: {},
    emit: () => undefined,
    askPermission: async () => false,
    ...(devTools === undefined ? {} : { devTools }),
  })
  const result = await core.query('app.getState', {}, { actor: 'user' })
  if (!result.ok) throw new Error('app.getState failed')
  return result.data as AppState
}

describe('app.getState devTools [SPEC 4.3, 14 step 0 R1]', () => {
  it('is false by default', async () => {
    expect((await stateWith()).devTools).toBe(false)
  })

  it('is true when createCore gets devTools: true', async () => {
    expect((await stateWith(true)).devTools).toBe(true)
  })
})
