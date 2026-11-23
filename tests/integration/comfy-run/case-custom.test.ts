// CW-8: test:comfy case 9, a custom workflow, against the stand-in. It runs only with
// ADMAN_COMFY_CUSTOM=1 in its own env; the shipped Flux graph, marked in the test, passes the
// file checks and toCustomSpec; the check asks for each node type and no model folder; the
// test-made picture goes up under uploadName; the graph sent is the marked one with the run's
// values. Nothing here contacts a real server or reads the process env.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { uploadName } from '@/main/providers/comfyui/values'
import { flux3KleinEditReferences as shipped } from '@/main/providers/comfyui/workflows/flux3'
import { greyPng } from '@/main/providers/fake/png'
import type { Graph } from '@/main/providers/comfyui/workflows/types'
import { recordCalls } from '../../comfy/recorder'
import { makePrinter } from '../../comfy/print'
import { makeTestPicture } from '../../comfy/test-picture'
import { customCase, type CaseKit } from '../../comfy/cases'
import { markedFluxSpec, markedFluxText } from '../../comfy/custom-case'

let stand: StandIn | undefined
let outDir = ''
afterEach(async () => {
  await stand?.close()
  stand = undefined
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true })
  outDir = ''
})

const ID = '7d2c1b0a-9e8f-4a6b-8c5d-4e3f2a1b0c9d'

async function setUp(env: Record<string, string>) {
  stand = await startComfyStandIn()
  const s = stand
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-comfy-custom-'))
  s.reply('GET /view', { body: greyPng(4, 4), headers: { 'content-type': 'image/png' } })
  const images = [{ filename: 'out.png', subfolder: '', type: 'temp' }]
  const entry = {
    status: { status_str: 'success', completed: true },
    outputs: { '15': { images } },
  }
  s.reply(`GET /history/${ID}`, { json: { [ID]: entry } })
  const printed: string[] = []
  const recorded = recordCalls(createComfyClient({ origin: s.origin, ownPorts: () => [] }))
  const kit: CaseKit = {
    client: recorded.client,
    print: makePrinter(s.origin, (line) => printed.push(line)),
    timing: { pollMs: 1, limitMs: 60_000, now: Date.now, sleep: () => Promise.resolve() },
    outDir,
    env,
    newId: () => ID,
    fieldNames: { shown: true },
  }
  return { s, printed, kit }
}

describe('test:comfy case 9, a custom workflow [CW-8, D-104]', () => {
  it('runs only with ADMAN_COMFY_CUSTOM=1, and contacts nothing without it', async () => {
    const { s, kit } = await setUp({ ADMAN_COMFY_CUSTOM: 'yes' })
    expect(await customCase(kit)).toEqual({
      skip: 'ADMAN_COMFY_CUSTOM is not 1, so the custom workflow case does not run.',
    })
    expect(s.seen).toEqual([])
  })

  it('marks the shipped graph so it passes the file checks as a custom image_refs workflow', () => {
    const graph = JSON.parse(markedFluxText()) as Graph
    expect(Object.keys(graph).sort()).toEqual(Object.keys(shipped.graph).sort())
    const spec = markedFluxSpec()
    expect(spec).toMatchObject({ status: 'custom', job: 'image_refs' })
    expect(spec.slots).toMatchObject({
      prompt: { node: '6', input: 'text' },
      seed: [{ node: '9', input: 'seed' }],
      outputNode: '15',
    })
    expect(spec.needs.models).toEqual([])
    expect([...spec.needs.nodeClasses].sort()).toEqual([...shipped.needs.nodeClasses].sort())
  })

  it('checks each node type, sends the test-made picture and the marked graph, and passes', async () => {
    const { s, kit, printed } = await setUp({ ADMAN_COMFY_CUSTOM: '1' })
    expect(await customCase(kit)).toEqual({ done: true })
    const paths = s.seen.map((r) => r.path)
    expect(paths.filter((p) => p.startsWith('/object_info/'))).toHaveLength(
      new Set(shipped.needs.nodeClasses).size,
    )
    expect(paths.some((p) => p.startsWith('/models/'))).toBe(false)
    const picture = makeTestPicture()
    const upload = s.seen.find((r) => r.path === '/upload/image')
    expect(upload?.body.toString('latin1')).toContain(`filename="${uploadName(picture)}"`)
    const posts = s.seen.filter((r) => r.path === '/prompt')
    expect(posts).toHaveLength(1)
    const sent = (JSON.parse(posts[0]?.body.toString('utf8') ?? '{}') as { prompt: Graph }).prompt
    expect(sent['6']?.inputs.text).toBe(
      'The same shapes and colours, drawn as a watercolour painting',
    )
    expect(sent['10']?.inputs.image).toBe(`adman/${uploadName(picture)}`)
    expect(sent['15']?._meta?.title).toBe('adman: output')
    expect(printed).toContain('Custom workflow: image_refs, 9 node types')
    expect(printed).toContain('Pixel size: 4 x 4')
    const text = printed.join('\n')
    expect(text.includes('127.0.0.1') || text.includes(s.origin)).toBe(false)
  })
})
