// CW-7 (spec/comfyui-custom.md "The check and what is missing"; spec/comfyui.md "The check"):
// a custom workflow whose node type the stand-in lacks. The check asks once per distinct
// type, the name encoded, and no model folder for it; a run fails missing_items holding no
// name; a server that is not ComfyUI still gets exactly one request; a run after an add never
// uses a kept check that lacks the new workflow. Nothing here contacts a real server.
import { describe, it, expect, afterEach } from 'vitest'
import { checkWorkflowText } from '@/main/providers/comfyui/custom/check-file'
import { NON_DRAFT_WORKFLOWS } from '@/main/providers/comfyui/workflows'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import { readWireRows } from '@/main/db/rows'
import { fixtureText } from '../../fixtures/comfy-custom/load'
import { requestLines } from '../../helpers/comfy-run'
import { data } from '../core-fixture'
import { customRunSetUp, jobEnds, prompts, type CustomRun } from '../generation/custom-run-fixture'

let r: CustomRun
afterEach(() => r.close())

const LACKING = 'Lens Flare/Pro'
const LACKING_PATH = `/object_info/${encodeURIComponent(LACKING)}`

// The picture fixture with two nodes of one type the stand-in will lack.
function addLacking(): string {
  const graph = JSON.parse(fixtureText('picture')) as Record<string, unknown>
  for (const id of ['20', '21']) {
    graph[id] = { class_type: LACKING, inputs: { images: ['8', 0] }, _meta: { title: 'Flare' } }
  }
  const result = checkWorkflowText(JSON.stringify(graph))
  if (!result.ok) throw new Error('the graph failed the checks')
  const store = r.f.core.deps.comfyWorkflows
  return store.add({ checked: result.data, name: 'Harbour flare', addedBy: 'user' }).stored.id
}

const lack = () => r.stand.reply(`GET ${LACKING_PATH}`, { status: 404, json: { error: 'x' } })

const check = () => r.f.core.bus.execute('comfy.check', {}, { actor: 'user' })

const shippedFolders = () =>
  new Set(NON_DRAFT_WORKFLOWS.flatMap((w) => w.needs.models.map((m) => m.folder))).size

describe('comfy.check with a custom workflow the server lacks a type for [CW-7]', () => {
  it('lists the type under the workflow, asking once per distinct type, encoded', async () => {
    r = await customRunSetUp()
    const id = addLacking()
    lack()
    const result = data<ComfyCheck>(await check())
    expect(result.outcome).toBe('ok')
    expect(result.workflows.find((w) => w.id === id)?.missing).toEqual([
      { what: 'node', name: LACKING },
    ])
    const lines = requestLines(r.stand)
    expect(lines.filter((l) => l === `GET ${LACKING_PATH}`)).toHaveLength(1)
    expect(lines.filter((l) => l.startsWith('GET /object_info/Lens'))).toHaveLength(1)
    const classes = new Set(lines.filter((l) => l.startsWith('GET /object_info/')))
    expect(classes.size).toBe(lines.filter((l) => l.startsWith('GET /object_info/')).length)
  })

  it('asks for no model folder for the custom workflow', async () => {
    r = await customRunSetUp()
    addLacking()
    data(await check())
    const folders = requestLines(r.stand).filter((l) => l.startsWith('GET /models/'))
    expect(folders).toHaveLength(shippedFolders())
  })

  it('sends exactly one GET /system_stats to a server that is not ComfyUI', async () => {
    r = await customRunSetUp()
    addLacking()
    r.stand.reply('GET /system_stats', { status: 404, json: {} })
    const result = data<ComfyCheck>(await check())
    expect(result.outcome).toBe('not_comfyui')
    expect(requestLines(r.stand)).toEqual(['GET /system_stats'])
  })
})

describe('a run of a custom workflow the server lacks a type for [CW-7, rule 2]', () => {
  it('fails missing_items with an empty list and the count, and no type in the job row', async () => {
    r = await customRunSetUp()
    const id = addLacking()
    lack()
    const reply = (await r.f.run({ workflowId: id })) as { data?: { jobId: string } }
    const job = await jobEnds(r.f, reply.data?.jobId ?? '')
    expect(job).toMatchObject({
      status: 'failed',
      errorKind: 'other',
      errorReason: 'missing_items',
      result: { missing: [], missingCount: 1 },
    })
    expect(prompts(r.stand)).toEqual([])
    const seen = JSON.stringify([readWireRows(r.f.db, 'job'), r.f.events])
    expect(seen).not.toContain('Lens Flare')
    expect(seen).not.toContain(encodeURIComponent(LACKING))
  })

  it('a not-ComfyUI server sees exactly one GET /system_stats for the run', async () => {
    r = await customRunSetUp()
    const id = addLacking()
    r.stand.reply('GET /system_stats', { status: 404, json: {} })
    const reply = (await r.f.run({ workflowId: id })) as { data?: { jobId: string } }
    expect((await jobEnds(r.f, reply.data?.jobId ?? ''))?.errorReason).toBe('not_comfyui')
    expect(requestLines(r.stand)).toEqual(['GET /system_stats'])
  })

  it('after an add, does not use a kept check that lacks the new workflow', async () => {
    r = await customRunSetUp()
    data(await check())
    // Added straight into the store, so nothing empties the kept check.
    const id = addLacking()
    lack()
    const reply = (await r.f.run({ workflowId: id })) as { data?: { jobId: string } }
    const job = await jobEnds(r.f, reply.data?.jobId ?? '')
    expect(job).toMatchObject({ errorReason: 'missing_items', result: { missingCount: 1 } })
    const stats = requestLines(r.stand).filter((l) => l === 'GET /system_stats')
    expect(stats).toHaveLength(2)
  })
})
