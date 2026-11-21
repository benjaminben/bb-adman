// A core with its MCP port set to a free port on 127.0.0.1. The token the app makes is
// read back from the secret store, and never printed by a test.
import { makeFixture, data, type Fixture } from '../core-fixture'
import { freePort } from './http-client'
import type { SecretCrypto } from '../../../src/main/core'

export type McpFixture = Fixture & { port: number; token: () => Promise<string> }

export async function makeMcpFixture(opts: { crypto?: SecretCrypto } = {}): Promise<McpFixture> {
  const f = makeFixture(opts)
  const port = await freePort()
  data(await f.user('settings.update', { mcp: { port } }))
  const token = async () => {
    const saved = f.core.secrets.get('mcp.token')
    if (!saved) throw new Error('no token has been made')
    return saved
  }
  return Object.assign(f, { port, token })
}

export async function stopAndClean(f: Fixture | undefined): Promise<void> {
  if (!f) return
  await f.core.mcp.stop()
  f.cleanup()
}
