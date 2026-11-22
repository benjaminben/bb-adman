// The named test "render_variant writes no file" (spec/testing.md; FR-193, D-030; P10-3).
// Lists every file under the project's folder, its assets folder, the app data folder and a
// folder set as the system's temporary folder; calls the tool; lists again. Equal apart from
// the activity log. The reply is one image/png item of the drawn bytes, with no path (A-234).
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { replyJson, toolSession, type ToolReply } from './tool-client'
import {
  HIDDEN_WORDS,
  OUTSIDE,
  PNG,
  VARIANT,
  renderSetUp,
  type RenderSetUp,
} from './render-variant-fixture'

let r: RenderSetUp | undefined
const savedTmp = process.env.TMPDIR
afterEach(async () => {
  await r?.core.mcp.stop()
  r?.cleanup()
  r = undefined
  process.env.TMPDIR = savedTmp
})

// Every file under dir as "path size", the activity log left out.
function listing(dir: string, logs: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return full === logs ? [] : listing(full, logs)
    return [`${full} ${fs.statSync(full).size}`]
  })
}

function folders(set: RenderSetUp): string[][] {
  const logs = path.join(set.userData, 'logs')
  return [set.projectDir, set.assetsDir, set.userData, set.tmp].map((d) => listing(d, logs))
}

async function ready(set: RenderSetUp) {
  process.env.TMPDIR = set.tmp
  data(await set.core.bus.execute('mcp.setEnabled', { enabled: true }, { actor: 'user' }))
  const token = set.core.secrets.get('mcp.token')
  if (!token) throw new Error('no token has been made')
  return toolSession(set.port, token)
}

// The key check of reply-keys.test.ts, here so that file's tests do not run twice.
const RISKY = /path|dir|file|url|address|host|token|secret|key/i
function riskyKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(riskyKeys)
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => [...(RISKY.test(k) ? [k] : []), ...riskyKeys(v)])
}

// The fixture's names and folders, an asset address, and the word test's words.
function noHiddenWord(set: RenderSetUp, text: string): void {
  const words = ['adman-asset:', 'comfyui', 'baseUrl', 'agentRuns']
  for (const word of [...HIDDEN_WORDS, set.outsideDir, set.projectDir, ...words]) {
    expect(text.includes(word), word).toBe(false)
  }
}

describe('render_variant writes no file [FR-193, D-030, P10-3]', () => {
  it('lists the same files before and after, and replies one image/png item', async () => {
    r = await renderSetUp()
    const s = await ready(r)
    const before = folders(r)
    const reply = await s.call('render_variant', { project_id: r.projectId, variant_id: VARIANT })
    expect(folders(r)).toEqual(before)
    expect(reply).toEqual({
      content: [
        { type: 'image', data: Buffer.from(PNG).toString('base64'), mimeType: 'image/png' },
      ],
    })
    expect(riskyKeys(reply)).toEqual([])
    noHiddenWord(r, JSON.stringify(reply))
  })

  it('draws the linked picture outside the project folder for the agent [A-234]', async () => {
    r = await renderSetUp()
    const s = await ready(r)
    await s.call('render_variant', {
      project_id: r.projectId,
      variant_id: VARIANT,
      max_dimension: 256,
    })
    const call = r.draw.mock.calls[0]
    expect(call?.[1]).toEqual({ width: 205, height: 256 })
    expect(call?.[0].assets[OUTSIDE]?.missing).toBe(false)
    expect(call?.[0].layers.some((l) => l.source?.assetId === OUTSIDE)).toBe(true)
    noHiddenWord(r, r.readLogs())
  })

  it('takes project_id, variant_id, max_dimension and time_ms and nothing else', async () => {
    r = await renderSetUp()
    const s = await ready(r)
    const tool = (await s.list()).find((t) => t.name === 'render_variant')
    const schema = tool?.inputSchema as { properties: Record<string, unknown> }
    expect(Object.keys(schema.properties).sort()).toEqual(
      ['max_dimension', 'project_id', 'time_ms', 'variant_id'].sort(),
    )
  })

  it.each([
    ['an unknown variant', { variant_id: 'made-up-variant' }],
    ['a size over the cap', { max_dimension: 4096 }],
    ['a project that is not open', { project_id: 'made-up-project' }],
  ])('refuses %s as a text error with no path and writes no file', async (_case, args) => {
    r = await renderSetUp()
    const s = await ready(r)
    const before = folders(r)
    const reply: ToolReply = await s.call('render_variant', {
      project_id: r.projectId,
      variant_id: VARIANT,
      ...args,
    })
    expect(reply.isError).toBe(true)
    expect(reply.content?.map((i) => i.type)).toEqual(['text'])
    expect(folders(r)).toEqual(before)
    // The app's own refusal is JSON; the MCP library's schema refusal is plain text.
    const text = reply.content?.[0]?.text ?? ''
    if (text.startsWith('{')) expect(riskyKeys(replyJson(reply))).toEqual([])
    noHiddenWord(r, JSON.stringify(reply))
  })
})
