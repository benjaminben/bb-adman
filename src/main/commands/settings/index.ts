import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { settingsUpdate, type PortWatcher } from './update'

// Core passes the MCP service so a port change restarts the server (SPEC 14 1.58 J-7).
export function settingsCommands(deps: CoreDeps, mcp?: PortWatcher): CommandHandler[] {
  return [settingsUpdate(deps, mcp)]
}
