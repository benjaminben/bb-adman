// Plain text for a hand-test result (SPEC 14 slice I). A failure shows the error's own message.
import type { Result } from '../../shared/schemas/result'

type StorageData = { name?: string; size?: number; names?: string[]; removed?: number }

export function failedText(result: Result<unknown>): string | null {
  return result.ok ? null : `Failed: ${result.error.message}`
}

export function storageText(result: Result<unknown>): string {
  const failed = failedText(result)
  if (failed !== null) return failed
  const data = (result.ok ? result.data : null) as StorageData | null
  if (data?.names) {
    return data.names.length === 0
      ? 'No files.'
      : `${data.names.length} files: ${data.names.join(', ')}`
  }
  if (data?.removed !== undefined) return `Removed ${data.removed} files.`
  return `Uploaded ${data?.name ?? ''} (${data?.size ?? 0} bytes).`
}
