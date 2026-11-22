// P10-9 (spec/phases/phase-10.md, "Bridge", A-245): the Claude Desktop field of
// mcp.getConnectInfo. A JSON text that starts the app in bridge mode; no token in it.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from '../mcp/mcp-fixture'
import { setBridgeLaunch } from '@/main/bridge/launch-command'
import type { ConnectInfo } from '@/shared/schemas/queries/mcp'

let f: McpFixture | undefined
afterEach(async () => {
  setBridgeLaunch(null)
  await stopAndClean(f)
  f = undefined
})

const PACKAGED = { execPath: '/Applications/Adman.app/Contents/MacOS/Adman', packaged: true }
const DEV_EXE = '/made-up/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'
const UNPACKAGED = { execPath: DEV_EXE, packaged: false, appPath: '/made-up/adman' }
const WINDOWS = { execPath: 'C:\\Program Files\\Adman\\Adman.exe', packaged: true }

async function info(): Promise<ConnectInfo> {
  return data<ConnectInfo>(await f!.core.query('mcp.getConnectInfo', {}, { actor: 'user' }))
}

async function onWith(launch: Parameters<typeof setBridgeLaunch>[0]) {
  f = await makeMcpFixture()
  setBridgeLaunch(launch)
  data(await f.user('mcp.setEnabled', { enabled: true }))
}

describe('mcp.getConnectInfo: the Claude Desktop text [P10-9, A-245]', () => {
  it('a packaged app: the executable and --mcp-bridge', async () => {
    await onWith(PACKAGED)
    const text = (await info()).claudeDesktop
    expect(JSON.parse(text ?? 'null')).toEqual({
      mcpServers: { adman: { command: PACKAGED.execPath, args: ['--mcp-bridge'] } },
    })
  })

  it('an unpackaged app: Electron, the app folder, then --mcp-bridge', async () => {
    await onWith(UNPACKAGED)
    const text = (await info()).claudeDesktop
    expect(JSON.parse(text ?? 'null')).toEqual({
      mcpServers: { adman: { command: DEV_EXE, args: ['/made-up/adman', '--mcp-bridge'] } },
    })
  })

  it('a Windows path stays one JSON string', async () => {
    await onWith(WINDOWS)
    const text = (await info()).claudeDesktop ?? ''
    expect(text).toContain('"C:\\\\Program Files\\\\Adman\\\\Adman.exe"')
    expect(JSON.parse(text).mcpServers.adman.command).toBe(WINDOWS.execPath)
  })

  it('holds no token and no address', async () => {
    await onWith(PACKAGED)
    const token = await f!.token()
    const got = await info()
    expect(got.token === token).toBe(true)
    expect((got.claudeDesktop ?? '').includes(token)).toBe(false)
    expect(got.claudeDesktop).not.toContain(String(f!.port))
  })

  it('is null while the setting is off', async () => {
    f = await makeMcpFixture()
    setBridgeLaunch(PACKAGED)
    expect((await info()).claudeDesktop).toBeNull()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    data(await f.user('mcp.setEnabled', { enabled: false }))
    expect((await info()).claudeDesktop).toBeNull()
  })

  it('is null when the app has not said how it was started', async () => {
    await onWith(null)
    expect((await info()).claudeDesktop).toBeNull()
  })
})
