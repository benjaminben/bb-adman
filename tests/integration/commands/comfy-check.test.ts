import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { WORKFLOW_IDS } from '../../../src/shared/schemas/queries/comfy'
import type { ComfyCheck } from '../../../src/shared/schemas/commands/comfy-check'

let f: Fixture
let stand: StandIn | undefined
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = undefined
})

const check = () => f.user('comfy.check', {})
const settingsText = () => {
  const file = path.join(f.userData, 'settings.json')
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

async function withStandIn(): Promise<StandIn> {
  f = makeFixture()
  stand = await startComfyStandIn()
  data(await f.user('comfy.setAddress', { address: stand.origin }))
  return stand
}

describe('comfy.check [SPEC 4.2, 6.10.3; FR-252]', () => {
  it('checks the saved server and lists every shipped workflow, without the address', async () => {
    const s = await withStandIn()
    const before = settingsText()
    const eventsBefore = f.events.length
    const result = data<ComfyCheck>(await check())
    expect(result.outcome).toBe('ok')
    expect(result.version).toBe('0.3.40')
    expect(result.workflows.map((w) => w.id)).toEqual([...WORKFLOW_IDS])
    // The stand-in is too old for every workflow and has none of the model files.
    for (const w of result.workflows) {
      expect(w.missing.some((m) => m.what === 'version')).toBe(true)
      expect(w.missing.some((m) => m.what === 'model')).toBe(true)
    }
    const text = JSON.stringify(result)
    expect(text).not.toContain(s.origin)
    expect(text).not.toContain(String(s.port))
    expect(settingsText()).toBe(before)
    expect(f.events.slice(eventsBefore)).not.toContainEqual({
      name: 'app.stateChanged',
      payload: {},
    })
  })

  it('sends no prompt, no picture and nothing that changes the server', async () => {
    const s = await withStandIn()
    data(await check())
    for (const r of s.seen) {
      expect(r.method).toBe('GET')
      expect(r.path).toMatch(/^\/(system_stats|models\/|object_info\/)/)
    }
  })

  it('against a server that is not ComfyUI sends exactly one request, GET /system_stats [1.43 N-03]', async () => {
    const s = await withStandIn()
    s.reply('GET /system_stats', {
      body: '<html>a router</html>',
      headers: { 'content-type': 'text/html' },
    })
    expect(data<ComfyCheck>(await check())).toEqual({ outcome: 'not_comfyui', workflows: [] })
    expect(s.seen.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /system_stats'])
  })

  it('asks the server again on each press', async () => {
    const s = await withStandIn()
    data(await check())
    const count = s.seen.length
    data(await check())
    expect(s.seen.length).toBe(count * 2)
  })

  it('gives no_answer when nothing answers at the address', async () => {
    const s = await withStandIn()
    s.reply('GET /system_stats', { vanish: true })
    expect(data<ComfyCheck>(await check())).toEqual({ outcome: 'no_answer', workflows: [] })
  })

  it('refuses with RULE_VIOLATION comfy_address_needed when no address is saved, and sends nothing', async () => {
    f = makeFixture()
    stand = await startComfyStandIn()
    const before = settingsText()
    const result = await check()
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'comfy_address_needed' } },
    })
    expect(stand.seen).toEqual([])
    expect(settingsText()).toBe(before)
  })

  it('refuses an input it does not take', async () => {
    f = makeFixture()
    expect(await f.user('comfy.check', { address: 'http://192.168.1.20:8188' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('refuses an agent, and the agent reaches no server', async () => {
    const s = await withStandIn()
    expect(await f.agent('comfy.check', {})).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect(s.seen).toEqual([])
  })
})
