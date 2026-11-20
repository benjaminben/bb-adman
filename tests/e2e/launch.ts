// Launches the built app against temporary folders. The mock keychain keeps tests
// out of the real macOS Keychain; projects go to a temporary folder, not Documents.
import { _electron as electron, type ElectronApplication } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export type Sandbox = { root: string; userData: string; projects: string }

export function makeSandbox(): Sandbox {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-e2e-'))
  const userData = path.join(root, 'userData')
  const projects = path.join(root, 'projects')
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(
    path.join(userData, 'settings.json'),
    JSON.stringify({ defaultProjectDir: projects }),
  )
  return { root, userData, projects }
}

export async function launch(box: Sandbox, extraArgs: string[] = []): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.', '--use-mock-keychain', ...extraArgs],
    env: { ...process.env, ADMAN_USER_DATA_DIR: box.userData, ADMAN_FAKE_PROVIDERS: '1' },
  })
}
