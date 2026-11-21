// A core with the hand-test tools on (createCore devTools: true), over temporary folders.
// The app data folder is `userData`; `outside` is a folder beside it that no command may touch.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCore, type Core } from '../../../src/main/core'
import { fakeCrypto } from '../core-fixture'

export type DevFixture = {
  core: Core
  root: string
  userData: string
  outside: string
  handTestDir: string
  user: (name: string, input: unknown) => ReturnType<Core['bus']['execute']>
  agent: (name: string, input: unknown) => ReturnType<Core['bus']['execute']>
  readLogs: () => string
  cleanup: () => void
}

export function makeDevFixture(devTools = true): DevFixture {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-dev-')))
  const userData = path.join(root, 'userData')
  const outside = path.join(root, 'outside')
  fs.mkdirSync(path.join(root, 'Documents'), { recursive: true })
  fs.mkdirSync(outside, { recursive: true })
  const core = createCore({
    userDataDir: userData,
    documentsDir: path.join(root, 'Documents'),
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: {},
    emit: () => undefined,
    askPermission: async () => false,
    devTools,
  })
  return {
    core,
    root,
    userData,
    outside,
    handTestDir: path.join(userData, 'adman-hand-test'),
    user: (name, input) => core.bus.execute(name, input, { actor: 'user' }),
    agent: (name, input) => core.bus.execute(name, input, { actor: 'agent' }),
    readLogs: () => {
      const dir = path.join(userData, 'logs')
      if (!fs.existsSync(dir)) return ''
      return fs
        .readdirSync(dir)
        .map((n) => fs.readFileSync(path.join(dir, n), 'utf8'))
        .join('')
    },
    cleanup: () => {
      core.closeAll()
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

// Writes a small file in `dir` and returns its absolute path.
export function sourceFile(dir: string, name = 'note.txt', text = 'hand test'): string {
  const file = path.join(dir, name)
  fs.writeFileSync(file, text)
  return file
}
