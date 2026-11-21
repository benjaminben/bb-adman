// Reads and writes {userData}/settings.json. Only the app writes it (FR-170).
import fs from 'node:fs'
import path from 'node:path'
import {
  agentRunLimit,
  settingsSchema,
  type Settings,
  type SettingsPatch,
} from '@/shared/schemas/settings'
import { AGENT_MAX_ACTIVE_RUNS } from '@/shared/config/agent-runs'
import { parseComfyAddress } from '@/shared/comfy/address'
import { comfyOwnPorts } from '@/main/providers/comfyui/own-ports'
import { DEFAULT_MCP_PORT } from './defaults'

export const RECENT_LIMIT = 20

export type SettingsStore = ReturnType<typeof createSettingsStore>

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// [1.37] SPEC 13.1 item 4: the key __proto__ is skipped at every level, so a file cannot
// set an object's prototype. An object under a key the base lacks is copied the same way.
function merge<T>(base: T, patch: unknown): T {
  if (!isObject(patch)) return (patch === undefined ? base : patch) as T
  const out: Record<string, unknown> = isObject(base) ? { ...base } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (k !== '__proto__') out[k] = merge(out[k], v)
  }
  return out as T
}

// [1.37] SPEC 13.1 "After CU-1" (security class): an address found in the file is held as
// its origin when parseComfyAddress passes it, and as null otherwise. The refused text is
// kept nowhere, so the next save writes null over it.
function readComfyAddress(merged: unknown): unknown {
  if (!isObject(merged) || !isObject(merged.comfyui)) return merged
  const text = merged.comfyui.baseUrl
  const port = isObject(merged.mcp) ? merged.mcp.port : undefined
  const ownPorts = comfyOwnPorts(typeof port === 'number' ? port : DEFAULT_MCP_PORT)
  const result = typeof text === 'string' ? parseComfyAddress(text, ownPorts) : null
  const baseUrl = result && 'origin' in result ? result.origin : null
  return { ...merged, comfyui: { ...merged.comfyui, baseUrl } }
}

// AR-1: a limit in the file that is not a whole number in range loads as the default, so the
// rest of the file is still read.
function readAgentRunLimit(merged: unknown): unknown {
  if (!isObject(merged) || agentRunLimit.safeParse(merged.agentRunLimit).success) return merged
  return { ...merged, agentRunLimit: AGENT_MAX_ACTIVE_RUNS }
}

export function createSettingsStore(opts: { file: string; defaults: Settings }) {
  let current = load()

  function load(): Settings {
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(opts.file, 'utf8'))
      const parsed = settingsSchema.safeParse(
        readAgentRunLimit(readComfyAddress(merge(opts.defaults, raw))),
      )
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
    // Called only by comfy.setAddress, with an origin parseComfyAddress gave, or null.
    setComfyAddress(origin: string | null): void {
      save({ ...current, comfyui: { baseUrl: origin } })
    },
    // Called only by agentRuns.setAllowed, with a provider ID from the registry.
    setAgentRunAllowed(provider: string, allowed: boolean): void {
      save({ ...current, agentRuns: { ...current.agentRuns, [provider]: { allowed } } })
    },
    // Called only by agentRuns.setLimit, with a checked limit.
    setAgentRunLimit(limit: number): void {
      save({ ...current, agentRunLimit: limit })
    },
    // Called only by the MCP service, for mcp.setEnabled (SPEC 4.2 notes).
    setMcpEnabled(enabled: boolean): void {
      save({ ...current, mcp: { ...current.mcp, enabled } })
    },
    touchRecent(entry: { path: string; name: string }, openedAt: string): void {
      const others = current.recentProjects.filter((r) => r.path !== entry.path)
      const recentProjects = [{ ...entry, openedAt }, ...others].slice(0, RECENT_LIMIT)
      save({ ...current, recentProjects })
    },
  }
}
