// Builds the main-process core over temporary folders, as SPEC 10.2 describes:
// project files in one temporary folder, the app data folder in another.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createCore, type Core, type SecretCrypto } from '../../src/main/core'
import type { BusEvent } from '../../src/main/commands/bus'

// Stands in for Electron safeStorage. Reversible, and never stores the plain text.
export function fakeCrypto(available = true): SecretCrypto {
  return {
    isAvailable: () => available,
    encrypt: (text) =>
      Buffer.from(Buffer.from(text, 'utf8').toString('base64').split('').reverse().join('')),
    decrypt: (data) =>
      Buffer.from(data.toString().split('').reverse().join(''), 'base64').toString('utf8'),
  }
}

export type Fixture = {
  core: Core
  root: string
  userData: string
  documents: string
  projectsDir: string
  events: BusEvent[]
  user: (name: string, input: unknown) => ReturnType<Core['bus']['execute']>
  agent: (name: string, input: unknown) => ReturnType<Core['bus']['execute']>
  restart: (opts?: { crypto?: SecretCrypto }) => void
  readLogs: () => string
  cleanup: () => void
}

export function makeFixture(
  opts: { crypto?: SecretCrypto; env?: Record<string, string> } = {},
): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-core-'))
  const userData = path.join(root, 'userData')
  const documents = path.join(root, 'Documents')
  const projectsDir = path.join(root, 'work')
  fs.mkdirSync(documents, { recursive: true })
  fs.mkdirSync(projectsDir, { recursive: true })
  const events: BusEvent[] = []

  const build = (crypto: SecretCrypto) =>
    createCore({
      userDataDir: userData,
      documentsDir: documents,
      appVersion: '0.1.0',
      crypto,
      env: opts.env ?? {},
      emit: (e) => events.push(e),
      askPermission: async () => false,
    })

  const f: Fixture = {
    core: build(opts.crypto ?? fakeCrypto()),
    root,
    userData,
    documents,
    projectsDir,
    events,
    user: (name, input) => f.core.bus.execute(name, input, { actor: 'user' }),
    agent: (name, input) => f.core.bus.execute(name, input, { actor: 'agent' }),
    restart: (r) => {
      f.core.closeAll()
      f.core = build(r?.crypto ?? opts.crypto ?? fakeCrypto())
    },
    readLogs: () => {
      const dir = path.join(userData, 'logs')
      if (!fs.existsSync(dir)) return ''
      return fs
        .readdirSync(dir)
        .map((n) => fs.readFileSync(path.join(dir, n), 'utf8'))
        .join('')
    },
    cleanup: () => {
      f.core.closeAll()
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
  return f
}

export function data<T>(result: { ok: boolean; data?: unknown; error?: unknown }): T {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`)
  return result.data as T
}
