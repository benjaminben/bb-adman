// mcp.getConnectInfo (SPEC 4.3, 6.8; D-014): the Connect panel's content. The only reply
// that holds a secret value, for the user actor only.
export type ConnectInfo = {
  enabled: boolean
  address: string
  port: number
  // The full MCP access token, or null if none has been made yet.
  token: string | null
  // The Claude Code setup line of 6.8, or null while there is no token.
  claudeCode: string | null
}
