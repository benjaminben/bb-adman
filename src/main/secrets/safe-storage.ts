// Electron safeStorage behind the SecretCrypto interface (SPEC 5.3, 7.7):
// Keychain on macOS, DPAPI on Windows.
import { safeStorage } from 'electron'
import type { SecretCrypto } from './secret-store'

export const safeStorageCrypto: SecretCrypto = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (text) => safeStorage.encryptString(text),
  decrypt: (data) => safeStorage.decryptString(data),
}
