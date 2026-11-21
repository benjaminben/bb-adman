import { z } from 'zod'
import { AGENT_RUN_LIMIT_MAX, AGENT_RUN_LIMIT_MIN } from '@/shared/config/agent-runs'

// SPEC 13.1 settings.json. Defaults live in src/main/settings/defaults.ts.
const recentProject = z.object({ path: z.string(), name: z.string(), openedAt: z.string() })

const defaultProviders = z.object({
  image: z.string(),
  layout: z.string(),
  text: z.string(),
  video: z.string(),
})
const generation = z.object({ optionsPerRun: z.number().int().min(1) })
const exportSettings = z.object({
  imageFormat: z.enum(['png', 'jpg']),
  jpgQuality: z.number().int().min(1).max(100),
  fps: z.union([z.literal(30), z.literal(60)]),
})
const mcp = z.object({
  enabled: z.boolean(),
  port: z.number().int().min(1024).max(65535),
  autoApproveDestructive: z.boolean(),
})
const s3 = z.object({ bucket: z.string(), region: z.string(), prefix: z.string() })
const dropbox = z.object({ accountName: z.string(), rootPath: z.string() })
const storage = z.object({ s3: s3.nullable(), dropbox: dropbox.nullable() })
// [1.24] Security class. None of these keys is in settingsPatchSchema; each has one writer
// command: comfy.setAddress for the address (an origin, SPEC 6.10.1), agentRuns.setAllowed for
// a provider's tick and agentRuns.setLimit for agentRunLimit (spec/agent-runs.md).
const comfyui = z.object({ baseUrl: z.string().nullable() })
const agentRuns = z.record(z.string(), z.object({ allowed: z.boolean() }))
export const agentRunLimit = z.number().int().min(AGENT_RUN_LIMIT_MIN).max(AGENT_RUN_LIMIT_MAX)
// S2-4 [D-088]: the model labels the user confirmed a commercial licence for.
export const licenceConfirmed = z.array(z.string().min(1).max(100)).max(50)

export const settingsSchema = z.object({
  defaultProjectDir: z.string().min(1),
  recentProjects: z.array(recentProject).max(20),
  defaultProviders,
  generation,
  export: exportSettings,
  mcp,
  storage,
  comfyui,
  agentRuns,
  agentRunLimit,
  licenceConfirmed,
})
export type Settings = z.infer<typeof settingsSchema>
export type RecentProject = z.infer<typeof recentProject>

// settings.update input. recentProjects is kept by the app, and mcp.enabled is
// changed only by mcp.setEnabled, which also starts or stops the server.
export const settingsPatchSchema = z
  .object({
    defaultProjectDir: z.string().min(1),
    defaultProviders: defaultProviders.partial().strict(),
    generation: generation.partial().strict(),
    export: exportSettings.partial().strict(),
    mcp: mcp.omit({ enabled: true }).partial().strict(),
    storage: storage.partial().strict(),
    licenceConfirmed,
  })
  .partial()
  .strict()
export type SettingsPatch = z.infer<typeof settingsPatchSchema>
