// P10-11 (spec/phases/phase-10-slices.md; spec/mcp-and-agents.md, add_variant; D-099, A-141):
// an agent adds a variant as one fan-out cell with fit scale and no translation job, and
// deletes one only after the user allows it. A master is refused by the command. Deleting has
// no undo and clears the campaign's undo list. Every reply is an ID through a picker and holds
// no path, hash, prompt, key or provider text (security class full).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data } from '../core-fixture'
import { insertAsset } from '../row-fixtures'
import { replyJson, type ToolReply, type ToolSession } from './tool-client'
import { askSetUp, riskyKeys, type AskSetUp } from './ask-fixture'
import { readWireRows } from '@/main/db/rows'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

let x: AskSetUp | undefined
afterEach(async () => {
  vi.useRealTimers()
  await x?.close()
  x = undefined
})

type Made = { directionId: string; masterId: string }

function db(s: AskSetUp) {
  const handle = s.core.projects.get(s.projectId)
  if (!handle) throw new Error('the project is not open')
  return handle.db
}
const variants = (s: AskSetUp) => readWireRows(db(s), 'variant') as VariantRow[]
const layersOf = (s: AskSetUp, variantId: string) =>
  (readWireRows(db(s), 'layer') as LayerRow[]).filter((l) => l.variantId === variantId)
const jobCount = (s: AskSetUp) =>
  (db(s).prepare('SELECT COUNT(*) AS n FROM job').get() as { n: number }).n

// The campaign's one direction and its master, as campaign.create wrote them.
function made(s: AskSetUp): Made {
  const row = db(s)
    .prepare('SELECT id, master_variant_id AS masterId FROM direction WHERE campaign_id = ?')
    .get(s.campaignId) as { id: string; masterId: string } | undefined
  if (!row) throw new Error('the campaign has no direction')
  return { directionId: row.id, masterId: row.masterId }
}

const addArgs = (s: AskSetUp, m: Made, extra: Record<string, unknown> = {}) => ({
  project_id: s.projectId,
  direction_id: m.directionId,
  size_label: '9x16',
  language: 'de',
  format: 'image',
  ...extra,
})

// The same cell added by the user, so it lands on the campaign's undo list.
async function userAdd(s: AskSetUp, m: Made, fit?: string): Promise<string> {
  const input = {
    projectId: s.projectId,
    directionId: m.directionId,
    sizeLabel: '9x16',
    language: 'de',
    format: 'image',
    ...(fit && { fit }),
  }
  return data<{ variantId: string }>(await s.user('variant.add', input)).variantId
}

// A wide picture on the master's background, so fit scale and fit crop place it apart.
function widePicture(s: AskSetUp, m: Made): void {
  insertAsset(db(s), { id: 'wide-picture' })
  db(s).prepare("UPDATE asset SET width = 2000, height = 1000 WHERE id = 'wide-picture'").run()
  db(s)
    .prepare("UPDATE layer SET source = ? WHERE variant_id = ? AND type = 'background'")
    .run('{"assetId":"wide-picture"}', m.masterId)
}

const undoCampaign = (s: AskSetUp) =>
  s.user('history.undo', { projectId: s.projectId, scope: `campaign:${s.campaignId}` })

// Layer values without the IDs, which differ between two variants made the same way.
const values = (ls: LayerRow[]) =>
  ls.map(({ id: _id, variantId: _v, ...rest }) => rest).sort((a, b) => (a.key < b.key ? -1 : 1))

const replies: ToolReply[] = []
async function call(s: ToolSession, tool: string, args: unknown): Promise<ToolReply> {
  const reply = await s.call(tool, args)
  replies.push(reply)
  return reply
}

describe('add_variant over MCP [P10-11; FR-195]', () => {
  it('adds one fan-out cell by the agent, text in the new language missing, no job', async () => {
    x = await askSetUp()
    const m = made(x)
    const s = await x.session()
    const before = variants(x).length
    const reply = await call(s, 'add_variant', addArgs(x, m))
    expect(reply.isError).toBeFalsy()
    const body = replyJson<{ variantId: string }>(reply)
    expect(Object.keys(body)).toEqual(['variantId'])
    expect(variants(x)).toHaveLength(before + 1)
    const row = variants(x).find((v) => v.id === body.variantId)
    expect(row).toMatchObject({
      directionId: m.directionId,
      sizeLabel: '9x16',
      width: 1080,
      height: 1920,
      language: 'de',
      format: 'image',
      createdBy: 'agent',
    })
    expect(row?.agentChangedAt).not.toBeNull()
    const texts = layersOf(x, body.variantId).filter((l) => l.type === 'text')
    expect(texts.length).toBeGreaterThan(0)
    for (const t of texts) expect(t.translationStatus).toBe('missing')
    expect(jobCount(x)).toBe(0)
    expect(x.asked()).toEqual([])
  })

  it('drops a fit the agent sends: the layers are those of fit scale; the user can undo it', async () => {
    x = await askSetUp()
    const m = made(x)
    widePicture(x, m)
    const s = await x.session()
    const reply = await call(s, 'add_variant', addArgs(x, m, { fit: 'crop' }))
    const { variantId } = replyJson<{ variantId: string }>(reply)
    const byAgent = values(layersOf(x, variantId))
    data(await undoCampaign(x))
    expect(variants(x).some((v) => v.id === variantId)).toBe(false)
    expect(values(layersOf(x, await userAdd(x, m, 'scale')))).toEqual(byAgent)
    data(await undoCampaign(x))
    expect(values(layersOf(x, await userAdd(x, m, 'crop')))).not.toEqual(byAgent)
  })

  it('refuses a taken cell and an unknown direction, writing nothing', async () => {
    x = await askSetUp()
    const m = made(x)
    const s = await x.session()
    const before = variants(x).length
    expect((await call(s, 'add_variant', addArgs(x, m))).isError).toBeFalsy()
    const taken = await call(s, 'add_variant', addArgs(x, m))
    expect(taken.isError).toBe(true)
    expect(replyJson(taken)).toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'variant_exists' },
    })
    const gone = await call(s, 'add_variant', addArgs(x, m, { direction_id: 'made-up' }))
    expect(replyJson(gone)).toMatchObject({ code: 'NOT_FOUND' })
    expect(variants(x)).toHaveLength(before + 1)
  })
})

describe('delete_variant over MCP [P10-11; FR-197; D-099, A-141]', () => {
  const answer = (s: AskSetUp, requestId: string, allow: boolean) =>
    s.user('agent.answerPermission', { requestId, allow, rememberAuto: false })
  const exists = (s: AskSetUp, id: string) => variants(s).some((v) => v.id === id)

  it('asks with the variant line and no ID; allow deletes it with no undo', async () => {
    x = await askSetUp()
    const m = made(x)
    const variantId = await userAdd(x, m)
    const s = await x.session()
    const pending = call(s, 'delete_variant', { project_id: x.projectId, variant_id: variantId })
    const asked = await x.nthAsk()
    expect(asked).toMatchObject({
      action: 'delete variants',
      target: expect.stringMatching(/^Variant "[^"]+ · 9x16 · de" in campaign "Summer Splash!"$/),
    })
    const shown = JSON.stringify({ ...asked, requestId: '' })
    for (const id of [x.projectId, x.campaignId, variantId, m.directionId]) {
      expect(shown).not.toContain(id)
    }
    expect(exists(x, variantId)).toBe(true)
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual({ variantId })
    expect(exists(x, variantId)).toBe(false)
    expect(layersOf(x, variantId)).toEqual([])
    // No undo brings it back, and the user's own add before it is cleared too (A-141).
    const undo = await undoCampaign(x)
    expect(undo).toMatchObject({ ok: false, error: { details: { reason: 'nothing_to_undo' } } })
    expect(exists(x, variantId)).toBe(false)
  })

  it('refused by the user, deletes nothing and gives the refusal only', async () => {
    x = await askSetUp()
    const m = made(x)
    const variantId = await userAdd(x, m)
    const s = await x.session()
    const pending = call(s, 'delete_variant', { project_id: x.projectId, variant_id: variantId })
    data(await answer(x, (await x.nthAsk()).requestId, false))
    const reply = await pending
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual({
      code: 'AGENT_REFUSED',
      message: 'The user did not allow this action.',
      details: { reason: 'refused' },
    })
    expect(exists(x, variantId)).toBe(true)
    // The user's add is still on the campaign's list.
    data(await undoCampaign(x))
    expect(exists(x, variantId)).toBe(false)
  })

  it('a master is refused by the command after the allow, and stays', async () => {
    x = await askSetUp()
    const m = made(x)
    const s = await x.session()
    const pending = call(s, 'delete_variant', { project_id: x.projectId, variant_id: m.masterId })
    data(await answer(x, (await x.nthAsk()).requestId, true))
    expect(replyJson(await pending)).toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'master_variant' },
    })
    expect(exists(x, m.masterId)).toBe(true)
  })

  it('says in its description that it cannot be undone and clears the undo list', async () => {
    x = await askSetUp()
    const s = await x.session()
    const tool = (await s.list()).find((t) => t.name === 'delete_variant')
    expect(tool?.description).toContain('This cannot be undone.')
    expect(tool?.description).toContain('undo list of its whole campaign')
  })
})

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

describe('the two tools reply with IDs only [P10-11; FR-198]', () => {
  it('no recorded reply holds a risky key, a path, a hash or provider text', () => {
    expect(replies.length).toBeGreaterThan(0)
    for (const reply of replies) {
      const text = reply.content?.map((c) => c.text ?? '').join('') ?? ''
      expect(riskyKeys(parsed(text))).toEqual([])
      for (const word of ['/', '\\', 'adman-asset', 'hash', 'prompt', 'gemini', 'comfyui']) {
        expect(text.toLowerCase(), word).not.toContain(word)
      }
    }
  })
})
