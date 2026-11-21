import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { createCore, type Core } from '@/main/core'
import { fakeCrypto } from '../core-fixture'

let core: Core | null = null
let root = ''
afterEach(() => {
  core?.closeAll()
  core = null
  fs.rmSync(root, { recursive: true, force: true })
})

// The pickers live in windows/dialogs.ts and only the app window's IPC handler reaches
// them; the core query table, which agents and MCP use, does not know them.
describe('dialog.pickSaveFile is window only [Phase 6 section 1, P6-8]', () => {
  it.each(['agent', 'user'] as const)('is an unknown query to the core for %s', async (actor) => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-save-pick-core-'))
    core = createCore({
      userDataDir: path.join(root, 'userData'),
      documentsDir: path.join(root, 'Documents'),
      appVersion: '0.1.0',
      crypto: fakeCrypto(),
      env: {},
      emit: () => undefined,
      askPermission: async () => false,
    })
    const input = { purpose: 'translation-sheet', defaultPath: path.join(root, 'x.csv') }
    expect(await core.query('dialog.pickSaveFile', input, { actor })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})
