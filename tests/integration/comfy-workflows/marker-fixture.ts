// CW-8: a core built as index.ts builds it (no askPermission, so the real permission broker
// answers each ask), the slice H project, the stand-in's address saved and the ComfyUI tick
// on, with an MCP session. Not a test file. Nothing here contacts a real server.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCore, type Core } from '@/main/core'
import type { BusEvent } from '@/main/commands/bus'
import { readWireRows } from '@/main/db/rows'
import { data, fakeCrypto } from '../core-fixture'
import { seed, VARIANT } from '../generation/generation-fixture'
import { freePort } from '../mcp/http-client'
import { toolSession, type ToolSession } from '../mcp/tool-client'
import { startComfyStandIn } from '../../helpers/comfy-stand-in'
import { serveNeeds } from '../../helpers/comfy-run'
import type { EventMap } from '@/shared/schemas/events'

export type Marker = Awaited<ReturnType<typeof markerSetUp>>

const turn = () => new Promise<void>((r) => setImmediate(r))

export async function markerSetUp() {
  const stand = await startComfyStandIn()
  serveNeeds(stand)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-marker-'))
  // The person's own files, outside the folders the app writes.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-marker-src-'))
  const events: BusEvent[] = []
  const core: Core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: root,
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    // Debug lines are written too, so the log search covers them.
    env: { ADMAN_LOG_LEVEL: 'debug' },
    emit: (e) => events.push(e),
    toPng: (bytes) => bytes,
  })
  const user = (name: string, input: unknown) => core.bus.execute(name, input, { actor: 'user' })
  const agent = (name: string, input: unknown) => core.bus.execute(name, input, { actor: 'agent' })
  const created = await user('project.create', { name: 'Harbour Spring', location: root })
  const { projectId } = data<{ projectId: string }>(created)
  const project = core.projects.requireOpen(projectId)
  seed(project.db)
  data(await user('settings.update', { licenceConfirmed: ['MiniMax H3', 'FLUX 3 klein'] }))
  data(await user('comfy.setAddress', { address: stand.origin }))
  data(await user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
  const asked = () =>
    events.flatMap((e) => (e.name === 'agent.permissionRequested' ? [e.payload] : []))
  return {
    core,
    stand,
    root,
    outside,
    events,
    projectId,
    db: project.db,
    user,
    agent,
    asked,
    run: (workflowId: string, actor: 'user' | 'agent') =>
      core.bus.execute(
        'generation.runImages',
        {
          projectId,
          variantId: VARIANT,
          slot: 'background',
          prompt: 'A lighthouse at dusk',
          referenceAssetIds: [],
          count: 1,
          provider: 'comfyui',
          workflowId,
        },
        { actor },
      ),
    jobRows: () => readWireRows(project.db, 'job'),
    async session(): Promise<ToolSession> {
      data(await user('settings.update', { mcp: { port: await freePort() } }))
      data(await user('mcp.setEnabled', { enabled: true }))
      const token = core.secrets.get('mcp.token')
      if (!token) throw new Error('no token has been made')
      return toolSession(core.settings.get().mcp.port, token)
    },
    // Waits until the broker has sent its nth permission event (1 = the first).
    async nthAsk(n = 1): Promise<EventMap['agent.permissionRequested']> {
      for (let i = 0; i < 2_000 && asked().length < n; i++) await turn()
      const found = asked()[n - 1]
      if (!found) throw new Error('no permission event was sent')
      return found
    },
    allow: (requestId: string) =>
      user('agent.answerPermission', { requestId, allow: true, rememberAuto: false }),
    logs: () => readAll(path.join(root, 'userData', 'logs')),
    async close() {
      await core.mcp.stop()
      core.closeAll()
      await stand.close()
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(outside, { recursive: true, force: true })
    },
  }
}

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? filesUnder(full) : [full]
  })
}

function readAll(dir: string): string {
  return filesUnder(dir)
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('')
}

// Every file under the folder whose bytes hold the text, in any letter case.
export function filesHolding(dir: string, text: string): string[] {
  const needle = text.toLowerCase()
  return filesUnder(dir).filter((f) =>
    fs.readFileSync(f).toString('latin1').toLowerCase().includes(needle),
  )
}
