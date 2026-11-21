// Reads and writes {userData}/settings.json. Only the app writes it (FR-170).
import fs from 'node:fs'
import path from 'node:path'
import { settingsSchema, type Settings, type SettingsPatch } from '../../shared/schemas/settings'

export const RECENT_LIMIT = 20

export type SettingsStore = ReturnType<typeof createSettingsStore>

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function merge<T>(base: T, patch: unknown): T {
  if (!isObject(base) || !isObject(patch)) return (patch === undefined ? base : patch) as T
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) out[k] = merge(out[k], v)
  return out as T
}

// [1.35] SPEC 13.1 "Until CU-1": no check of a ComfyUI address exists yet, so an address
// found in the file is read as none, whatever it is. The file itself is left as it is.
// CU-1 replaces this with parseComfyAddress.
function readComfyAddress(raw: unknown): unknown {
  if (!isObject(raw) || !isObject(raw.comfyui)) return raw
  return { ...raw, comfyui: { ...raw.comfyui, baseUrl: null } }
}

export function createSettingsStore(opts: { file: string; defaults: Settings }) {
  let current = load()

  function load(): Settings {
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(opts.file, 'utf8'))
      const parsed = settingsSchema.safeParse(merge(opts.defaults, readComfyAddress(raw)))
      return parsed.success ? parsed.data : opts.defaults
    } catch {
      return opts.defaults
    }
  }

  function save(next: Settings): void {
    fs.mkdirSync(path.dirname(opts.file), { recursive: true })
    const tmp = `${opts.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2))
    fs.renameSync(tmp, opts.file)
    current = next
  }

  return {
    get: (): Settings => current,
    // The caller validates the patch; the merged result is checked again here.
    update(patch: SettingsPatch): Settings {
      save(settingsSchema.parse(merge(current, patch)))
      return current
    },
    touchRecent(entry: { path: string; name: string }, openedAt: string): void {
      const others = current.recentProjects.filter((r) => r.path !== entry.path)
      const recentProjects = [{ ...entry, openedAt }, ...others].slice(0, RECENT_LIMIT)
      save({ ...current, recentProjects })
    },
  }
}
