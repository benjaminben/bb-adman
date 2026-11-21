// mcp.getConnectInfo (SPEC 4.3, 6.8; D-014): the Connect panel's content. The only reply
// that holds a secret value, for the user actor only.

// Why the server is not running while the setting is on (SPEC 14 1.58 J-8, J-11).
export type McpProblem = 'port_in_use' | 'token_missing' | null

export type ConnectInfo = {
  enabled: boolean
  // True while the server is listening (SPEC 14 1.58 J-8).
  running: boolean
  problem: McpProblem
  address: string
  port: number
  // The full MCP access token, or null if none has been made yet.
  token: string | null
  // The Claude Code setup line of 6.8, or null while there is no token.
  claudeCode: string | null
}
