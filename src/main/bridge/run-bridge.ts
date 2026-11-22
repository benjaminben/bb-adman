// Bridge mode (spec/mcp-and-agents.md, "Bridge mode"; P10-9, A-244): `"{app}" --mcp-bridge`,
// as Claude Desktop starts it. No window, no single-instance lock, no listener, no file
// written. After app.whenReady() it reads mcp.port and mcp.enabled from settings.json and
// mcp.token from secrets.bin (safeStorage), in the app's own data folder, then relays stdio to
// http://127.0.0.1:{port}/mcp until its input ends. stdout carries only MCP messages; nothing
// is written to stderr, and an error never opens Electron's error box.
import path from 'node:path'
import { createSettingsStore } from '@/main/settings/settings-store'
import { defaultSettings } from '@/main/settings/defaults'
import { createSecretStore, type SecretCrypto } from '@/main/secrets/secret-store'
import { bridgeDoor, runRelay } from './relay'

// The few parts of Electron's app the bridge uses; index.ts hands them in (SPEC 12: only it
// may use Electron here).
export type BridgeApp = {
  whenReady(): Promise<void>
  getPath(name: 'userData' | 'documents'): string
  exit(code: number): void
  disableHardwareAcceleration(): void
  setActivationPolicy(policy: 'prohibited'): void
}

function readDoor(app: BridgeApp, crypto: SecretCrypto) {
  const userData = app.getPath('userData')
  const settings = createSettingsStore({
    file: path.join(userData, 'settings.json'),
    defaults: defaultSettings(app.getPath('documents')),
  })
  const secrets = createSecretStore({
    file: path.join(userData, 'secrets.bin'),
    crypto,
  })
  return bridgeDoor(settings.get().mcp, secrets.get('mcp.token') ?? null)
}

export function runBridge(app: BridgeApp, crypto: SecretCrypto): void {
  // Any failure ends the process quietly: Electron's own error box would be a window, and
  // could show an error's words.
  process.on('uncaughtException', () => app.exit(1))
  process.on('unhandledRejection', () => app.exit(1))
  // The client went away: nothing is left to answer.
  process.stdout.on('error', () => app.exit(0))
  app.disableHardwareAcceleration()
  if (process.platform === 'darwin') app.setActivationPolicy('prohibited')
  void app.whenReady().then(async () => {
    await runRelay({ input: process.stdin, output: process.stdout, door: readDoor(app, crypto) })
    app.exit(0)
  })
}
