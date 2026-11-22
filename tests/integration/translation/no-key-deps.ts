// Test helper for P6-15: the deps fan-out's translation step reads, as a fresh install has
// them: the providers without the fake, the default settings (Gemini for text) and no saved
// key, so a fan-out starts no translation job. Nothing is written to disk. Not a test file.
import os from 'node:os'
import path from 'node:path'
import type { CoreDeps } from '@/main/core-deps'
import { listProviders } from '@/main/providers/registry'
import { createSecretStore } from '@/main/secrets/secret-store'
import { defaultSettings } from '@/main/settings/defaults'
import { createSettingsStore } from '@/main/settings/settings-store'
import { fakeCrypto } from '../core-fixture'

export function noKeyDeps(): Partial<CoreDeps> {
  const none = path.join(os.tmpdir(), 'adman-no-key-deps-never-written')
  return {
    providers: listProviders({}),
    settings: createSettingsStore({
      file: path.join(none, 'settings.json'),
      defaults: defaultSettings(none),
    }),
    secrets: createSecretStore({ file: path.join(none, 'secrets.bin'), crypto: fakeCrypto() }),
  }
}
