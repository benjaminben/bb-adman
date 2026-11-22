// How Claude Desktop starts this app in bridge mode (P10-9, A-245): the Claude Desktop text of
// mcp.getConnectInfo. index.ts says once at start how the app itself was started; until it
// has, there is no text. Electron-free. The text holds no token: the bridge reads it itself.

export const BRIDGE_FLAG = '--mcp-bridge'

// A packaged app is its own executable; an unpackaged one is Electron given the app folder.
export type BridgeLaunch =
  { execPath: string; packaged: true } | { execPath: string; packaged: false; appPath: string }

let launch: BridgeLaunch | null = null

export function setBridgeLaunch(next: BridgeLaunch | null): void {
  launch = next
}

export function claudeDesktopText(): string | null {
  if (!launch) return null
  const args = launch.packaged ? [BRIDGE_FLAG] : [launch.appPath, BRIDGE_FLAG]
  const entry = { mcpServers: { adman: { command: launch.execPath, args } } }
  return JSON.stringify(entry, null, 2)
}
