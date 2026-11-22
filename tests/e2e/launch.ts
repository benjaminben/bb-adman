// Launches the built app against temporary folders. The mock keychain keeps tests
// out of the real macOS Keychain; projects go to a temporary folder, not Documents.
import { _electron as electron, type ElectronApplication } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { realAppEnv } from '../e2e-real/real-env'

export type Sandbox = { root: string; userData: string; projects: string }

export function makeSandbox(): Sandbox {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-e2e-'))
  const userData = path.join(root, 'userData')
  const projects = path.join(root, 'projects')
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(
    path.join(userData, 'settings.json'),
    JSON.stringify({ defaultProjectDir: projects, setup: { done: true } }),
  )
  return { root, userData, projects }
}

// The app window stays hidden and the app never comes to the front; ADMAN_SHOW_WINDOWS=1 shows it.
export function quietEnv(env: Record<string, string | undefined>): Record<string, string> {
  return env.ADMAN_SHOW_WINDOWS === '1' ? {} : { ADMAN_QUIET_WINDOWS: '1' }
}

export async function launch(
  box: Sandbox,
  extraArgs: string[] = [],
  extraEnv: Record<string, string> = {},
): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.', '--use-mock-keychain', ...extraArgs],
    env: {
      ...process.env,
      ADMAN_USER_DATA_DIR: box.userData,
      ADMAN_FAKE_PROVIDERS: '1',
      ...quietEnv(process.env),
      ...extraEnv,
    },
  })
}

// SPEC 14 1.56 E2E-R: the app for test:e2e:real. No fake providers, ADMAN_DEV_TOOLS on;
// the same sandbox folders and mock keychain, so nothing touches the real settings or
// Keychain. The address, key, photo paths and switches stay with the test (real-env.ts).
export async function launchReal(box: Sandbox): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.', '--use-mock-keychain'],
    env: { ...realAppEnv(process.env, box.userData), ...quietEnv(process.env) },
  })
}
