// P10-6: a core built as index.ts builds it (no askPermission, so the permission broker
// answers every ask), one project with one campaign, MCP on and a tool session. Not a test file.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { data, fakeCrypto } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { freePort } from './http-client'
import { toolSession, type ToolSession } from './tool-client'
import type { BusEvent } from '@/main/commands/bus'
import { createCore, type Core } from '@/main/core'
import type { EventMap } from '@/shared/schemas/events'

export type Asked = EventMap['agent.permissionRequested']

export type AskSetUp = {
  core: Core
  events: BusEvent[]
  projectId: string
  campaignId: string
  user: (name: string, input: unknown) => ReturnType<Core['bus']['execute']>
  agent: (name: string, input: unknown) => ReturnType<Core['bus']['execute']>
  session: () => Promise<ToolSession>
  asked: () => Asked[]
  // Waits until the broker has sent its nth permission event (1 = the first).
  nthAsk: (n?: number) => Promise<Asked>
  campaignExists: () => boolean
  readLogs: () => string
  close: () => Promise<void>
}

export const CLOCK = new Date('2026-11-21T10:00:00.000Z')

const turn = () => new Promise<void>((r) => setImmediate(r))

export async function askSetUp(): Promise<AskSetUp> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-ask-'))
  fs.mkdirSync(path.join(root, 'Documents'))
  const events: BusEvent[] = []
  const core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: path.join(root, 'Documents'),
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: {},
    now: () => CLOCK,
    emit: (e) => events.push(e),
  })
  const user = (name: string, input: unknown) => core.bus.execute(name, input, { actor: 'user' })
  const agent = (name: string, input: unknown) => core.bus.execute(name, input, { actor: 'agent' })
  const location = path.join(root, 'Documents')
  const { projectId } = data<{ projectId: string }>(
    await user('project.create', { name: 'Spring Work', location }),
  )
  const { campaignId } = data<{ campaignId: string }>(
    await user('campaign.create', { projectId, ...createInput() }),
  )
  const asked = () =>
    events.flatMap((e) => (e.name === 'agent.permissionRequested' ? [e.payload] : []))
  return {
    core,
    events,
    projectId,
    campaignId,
    user,
    agent,
    asked,
    async session() {
      data(await user('settings.update', { mcp: { port: await freePort() } }))
      data(await user('mcp.setEnabled', { enabled: true }))
      const token = core.secrets.get('mcp.token')
      if (!token) throw new Error('no token has been made')
      return toolSession(core.settings.get().mcp.port, token)
    },
    async nthAsk(n = 1) {
      for (let i = 0; i < 2_000 && asked().length < n; i++) await turn()
      const found = asked()[n - 1]
      if (!found) throw new Error('no permission event was sent')
      return found
    },
    campaignExists() {
      const db = core.projects.get(projectId)?.db
      return Boolean(db?.prepare('SELECT 1 FROM campaign WHERE id = ?').get(campaignId))
    },
    readLogs() {
      const dir = path.join(root, 'userData', 'logs')
      if (!fs.existsSync(dir)) return ''
      return fs
        .readdirSync(dir)
        .map((n) => fs.readFileSync(path.join(dir, n), 'utf8'))
        .join('')
    },
    async close() {
      await core.mcp.stop()
      core.closeAll()
      fs.rmSync(root, { recursive: true, force: true })
    },
  }
}

// The key check of reply-keys.test.ts (a test file, so not imported): keys named like a path,
// an address or a secret.
const RISKY = /path|dir|file|url|address|host|token|secret|key|setting|auto/i

export function riskyKeys(value: unknown, at = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => riskyKeys(v, `${at}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => {
    const here = at ? `${at}.${k}` : k
    return [...(RISKY.test(k) ? [here] : []), ...riskyKeys(v, here)]
  })
}

// The ask log lines (A-240), parsed.
export function askLines(logs: string): Array<Record<string, unknown>> {
  return logs
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>)
    .filter((l) => l.event === 'ask')
}
