// The named secret-leak test of SPEC 10.1, brought into MCP-A (SPEC 14, 1.56 point 4).
// A failure names the secret and the place, never the value.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from './mcp-fixture'
import { USER_SECRET_NAMES } from '@/shared/schemas/secrets'
import * as c from './http-client'
import { callEveryTool } from './every-tool'
import { BUILT_TOOLS } from './tool-client'
import { createInput } from '../campaigns/campaign-fixture'

let f: McpFixture | undefined
afterEach(async () => {
  await stopAndClean(f)
  f = undefined
})

// Made-up values that do not look like any real key.
const valueFor = (name: string) => `made-up-${name.replace('.', '-')}-value-for-leak-test`

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? filesUnder(full) : [full]
  })
}

async function httpReplies(fx: McpFixture, token: string): Promise<string[]> {
  const port = fx.port
  const ok = c.mcpHeaders(port, token)
  const id = await c.openSession(port, token)
  const inSession = c.sessionHeaders(port, token, id)
  const call = (n: number, method: string, params: unknown) => ({
    jsonrpc: '2.0',
    id: n,
    method,
    params,
  })
  const replies = await Promise.all([
    c.send({ port, headers: ok, body: c.INIT }),
    c.send({ port, headers: inSession, body: call(2, 'tools/list', {}) }),
    c.send({ port, headers: inSession, body: call(3, 'tools/call', { name: 'x' }) }),
    c.send({ port, headers: inSession, body: call(4, 'no/such/method', {}) }),
    c.send({ port, headers: { ...ok, authorization: 'Bearer made-up-wrong-token' } }),
    c.send({ port, headers: { ...ok, authorization: undefined }, body: c.INIT }),
    c.send({ port, headers: { ...ok, origin: 'https://made-up-page.example' }, body: c.INIT }),
    c.send({ port, headers: { ...ok, host: 'made-up-host.example' }, body: c.INIT }),
    c.send({ port, headers: ok, path: '/other' }),
    c.send({ port, headers: ok, method: 'GET' }),
    c.send({ port, headers: { ...ok, 'mcp-session-id': 'made-up-session' }, body: c.INIT }),
    c.send({ port, headers: ok, body: 'not json' }),
  ])
  const end = await c.send({ port, headers: inSession, method: 'DELETE' })
  return [...replies, end].map((r) => JSON.stringify(r))
}

describe('No MCP tool reply, log line or project file contains a secret value [SPEC 10.1; FR-198]', () => {
  it('holds for every secret name, mcp.token included, old and new', async () => {
    f = await makeMcpFixture()
    for (const name of USER_SECRET_NAMES) {
      data(await f.user('secret.set', { name, value: valueFor(name) }))
    }
    const project = data<{ projectId: string }>(
      await f.user('project.create', { name: 'Leak', location: f.projectsDir }),
    )
    const seen: string[] = []
    seen.push(JSON.stringify(await f.user('mcp.setEnabled', { enabled: true })))
    const first = await f.token()
    seen.push(...(await httpReplies(f, first)))
    seen.push(JSON.stringify(await f.user('mcp.regenerateToken', {})))
    const second = await f.token()
    seen.push(...(await httpReplies(f, second)))

    for (const [name, input] of [
      ['mcp.setEnabled', { enabled: false }],
      ['mcp.regenerateToken', {}],
      ['secret.set', { name: 'gemini.apiKey', value: 'made-up-agent-value' }],
      ['settings.update', { mcp: { port: 1 } }],
    ] as const) {
      seen.push(JSON.stringify(await f.agent(name, input)))
    }
    for (const name of ['mcp.getConnectInfo', 'app.getState', 'comfy.getInfo']) {
      seen.push(JSON.stringify(await f.core.query(name, {}, { actor: 'agent' })))
    }
    seen.push(JSON.stringify(await f.core.query('app.getState', {}, { actor: 'user' })))
    seen.push(JSON.stringify(f.events))
    seen.push(JSON.stringify(await f.user('mcp.setEnabled', { enabled: false })))

    const places: Array<[string, string]> = [
      ['reply', seen.join('\n')],
      ['log', f.readLogs()],
      ['settings.json', fs.readFileSync(path.join(f.userData, 'settings.json'), 'utf8')],
      ...filesUnder(f.projectsDir).map((p): [string, string] => [
        `project file ${path.basename(p)}`,
        fs.readFileSync(p).toString('latin1'),
      ]),
    ]
    expect(places.some(([where]) => where.startsWith('project file'))).toBe(true)
    expect(project.projectId).toBeTruthy()
    const secrets: Array<[string, string]> = [
      ...USER_SECRET_NAMES.map((n): [string, string] => [n, valueFor(n)]),
      ['mcp.token (first)', first],
      ['mcp.token (second)', second],
    ]
    for (const [where, text] of places) {
      for (const [name, value] of secrets) {
        expect(text.includes(value), `${name} found in ${where}`).toBe(false)
      }
    }
  })
})

// MCP-B: every tool is called, with good and bad arguments (SPEC 4.5, 14 1.56 point 8).
const COMFY = 'http://made-up-comfy-host.example:8188'
// AP-6 (spec/approvals.md "Named tests"): the approvals address; its key is approvals.apiKey above.
const APPROVALS = 'https://made-up-approvals-host.example.com'
// P10-1: a stored approvals link, its gallery slug and a reviewer's sign-off.
const SLUG = 'made-up-gallery-slug'
const REVIEWER = 'made-up-reviewer@example.com'

async function plantedProject(fx: McpFixture) {
  for (const name of USER_SECRET_NAMES) {
    data(await fx.user('secret.set', { name, value: valueFor(name) }))
  }
  data(await fx.user('comfy.setAddress', { address: COMFY }))
  data(await fx.user('approvals.setService', { address: APPROVALS }))
  const { projectId } = data<{ projectId: string }>(
    await fx.user('project.create', { name: 'Leak tools', location: fx.projectsDir }),
  )
  const { campaignId } = data<{ campaignId: string }>(
    await fx.user('campaign.create', { projectId, ...createInput() }),
  )
  const abs = path.join(fx.root, 'made-up-folder', 'made-up-leak-picture.png')
  fx.core.projects
    .requireOpen(projectId)
    .db.prepare(
      `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name,
        abs_path, rel_path, mime, byte_size, mtime_ms, content_hash, created_at)
       VALUES ('a1', 'asset', 'image', 'imported', 'linked', NULL, 'Picture', ?,
        'made-up-folder/made-up-leak-picture.png', 'image/png', 1, 1, 'h', '2026-01-01T00:00:00Z')`,
    )
    .run(abs)
  plantApprovals(fx, projectId, campaignId)
  return { projectId, campaignId }
}

function plantApprovals(fx: McpFixture, projectId: string, campaignId: string) {
  const db = fx.core.projects.requireOpen(projectId).db
  const { id } = db
    .prepare(
      'SELECT v.id FROM variant v JOIN direction d ON d.id = v.direction_id WHERE d.campaign_id = ?',
    )
    .get(campaignId) as { id: string }
  db.prepare(
    `INSERT INTO approval_link (campaign_id, slug, state, created_at, published_at)
     VALUES (?, ?, 'live', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run(campaignId, SLUG)
  db.prepare(
    `INSERT INTO approval_signoff (id, campaign_id, variant_id, version, email, signed_at)
     VALUES ('s1', ?, ?, 1, ?, '2026-01-02T00:00:00Z')`,
  ).run(campaignId, id, REVIEWER)
}

describe('No MCP tool reply holds a secret, the token, the ComfyUI address or a path [SPEC 10.1; 4.5; FR-198]', () => {
  it('holds for every listed tool, with good and bad arguments', async () => {
    f = await makeMcpFixture()
    const ids = await plantedProject(f)
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const token = await f.token()
    const { names, replies } = await callEveryTool(f.port, token, ids)
    expect(names).toEqual(BUILT_TOOLS)
    const text = replies.join('\n')
    expect(text.includes(ids.campaignId)).toBe(true)
    const secrets: Array<[string, string]> = [
      ...USER_SECRET_NAMES.map((n): [string, string] => [n, valueFor(n)]),
      ['mcp.token', token],
      ['the ComfyUI address', COMFY],
      ['the ComfyUI host', 'made-up-comfy-host.example'],
      ['the approvals address', APPROVALS],
      ['the approvals host', 'made-up-approvals-host.example.com'],
      ['the approvals gallery slug', SLUG],
      ['a reviewer email', REVIEWER],
    ]
    const places: Array<[string, string]> = [
      ['tool reply', text],
      ['log', f.readLogs()],
      ['events', JSON.stringify(f.events)],
    ]
    for (const [where, value] of places) {
      for (const [name, secret] of secrets) {
        expect(value.includes(secret), `${name} found in ${where}`).toBe(false)
      }
    }
    const paths: Array<[string, string]> = [
      ['the asset file name', 'made-up-leak-picture.png'],
      ['the temporary folder', f.root],
      ['the projects folder', f.projectsDir],
    ]
    for (const [name, p] of paths) {
      expect(text.includes(p), `${name} found in a tool reply`).toBe(false)
    }
  })
})
