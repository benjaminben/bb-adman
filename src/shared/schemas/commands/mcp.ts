import { z } from 'zod'

// mcp.setEnabled and mcp.regenerateToken (SPEC 4.2). App scope; agent policy deny.
export const mcpSetEnabledInput = z.object({ enabled: z.boolean() })
export const mcpRegenerateTokenInput = z.object({})
