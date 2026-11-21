// mcp.setEnabled and mcp.regenerateToken (SPEC 4.2; FR-191, R-04). App scope, agent policy
// deny. Neither reply holds the token: only mcp.getConnectInfo does (SPEC 4.3).
import { defineCommand, type CommandHandler } from '../types'
import type { McpService } from '../../mcp/service'
import { mcpRegenerateTokenInput, mcpSetEnabledInput } from '../../../shared/schemas/commands/mcp'

export function mcpCommands(mcp: McpService): CommandHandler[] {
  return [
    defineCommand({
      name: 'mcp.setEnabled',
      input: mcpSetEnabledInput,
      changesAppState: true,
      async run(_ctx, input) {
        await mcp.setEnabled(input.enabled)
        return { data: { enabled: input.enabled } }
      },
    }),
    defineCommand({
      name: 'mcp.regenerateToken',
      input: mcpRegenerateTokenInput,
      changesAppState: true,
      async run() {
        await mcp.regenerateToken()
        return { data: {} }
      },
    }),
  ]
}
