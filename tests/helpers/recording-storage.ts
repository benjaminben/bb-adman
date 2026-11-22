// Wraps a StorageProvider and records the paths of every call, in order, so a test can prove
// that nothing outside a folder was listed, read, written or removed (P9-8, P9-10).
import type { StorageProvider } from '@/main/providers/types'

export type StorageCall = {
  op: 'exists' | 'read' | 'write' | 'list' | 'remove'
  paths: string[]
}

export type RecordingStorage = StorageProvider & { calls: StorageCall[] }

export function recordingStorage(inner: StorageProvider): RecordingStorage {
  const calls: StorageCall[] = []
  return {
    calls,
    exists(path) {
      calls.push({ op: 'exists', paths: [path] })
      return inner.exists(path)
    },
    read(path) {
      calls.push({ op: 'read', paths: [path] })
      return inner.read(path)
    },
    write(path, data, contentType) {
      calls.push({ op: 'write', paths: [path] })
      return inner.write(path, data, contentType)
    },
    list(prefix) {
      calls.push({ op: 'list', paths: [prefix] })
      return inner.list(prefix)
    },
    remove(paths) {
      calls.push({ op: 'remove', paths: [...paths] })
      return inner.remove(paths)
    },
  }
}

// Every path of every recorded call.
export function recordedPaths(storage: RecordingStorage): string[] {
  return storage.calls.flatMap((call) => call.paths)
}
