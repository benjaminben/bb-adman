import path from 'node:path'
import { DEFAULT_PROVIDERS } from '../providers/registry'
import { DEFAULT_FPS } from '../../shared/config/defaults'
import type { Settings } from '../../shared/schemas/settings'

export const DEFAULT_MCP_PORT = 47821

// SPEC 13.1 defaults.
export function defaultSettings(documentsDir: string): Settings {
  return {
    defaultProjectDir: path.join(documentsDir, 'Adman Projects'),
    recentProjects: [],
    defaultProviders: { ...DEFAULT_PROVIDERS },
    generation: { optionsPerRun: 4 },
    export: { imageFormat: 'png', jpgQuality: 90, fps: DEFAULT_FPS },
    mcp: { enabled: false, port: DEFAULT_MCP_PORT, autoApproveDestructive: false },
    storage: { s3: null, dropbox: null },
  }
}
