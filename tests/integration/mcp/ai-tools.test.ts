// P10-5 (spec/phases/phase-10.md, A-231, A-232; security class full): propose_layout,
// copy_options and cut_out over the real HTTP door and the real core, on the fake provider
// only (it makes no network call). The agent-run gate refuses each one unticked, over the
// limit and with an unknown provider, with no job row; ticked, each starts a job the agent
// started, and get_job shows only the boxes, the option texts or the cut-out's asset ID. An
// agent cannot confirm a licence: no published input names one.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { jobReaches, runSetUp, startedId, getJob, type RunSetUp } from './run-tools-fixture'
import { AI_PICTURE, AI_TEXT, AI_VARIANT } from './ai-tools-fixture'
import { refusalOf, riskyKeys } from './layer-tools-fixture'
import { replyJson, type ToolReply } from './tool-client'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import { agentRunLimitMessage } from '@/main/commands/agent-run-gate'
import { birefnetCutout } from '@/main/providers/comfyui/workflows/birefnet'
import { licenceNotConfirmedMessage } from '@/shared/providers/messages'

let r: RunSetUp | undefined
afterEach(async () => {
  resetFakeBehaviour()
  await r?.close()
  r = undefined
})

const NOT_TICKED =
  "The user has not allowed agents to start runs with Fake provider. They can allow it in Adman's Settings."
const UNKNOWN = 'Agents cannot start runs with that provider.'
const OVER = agentRunLimitMessage('Fake provider')

type Args = (x: RunSetUp, provider: string) => Record<string, unknown>
const TOOLS: Array<[tool: string, args: Args]> = [
  [
    'propose_layout',
    (x, provider) => ({ project_id: x.projectId, variant_id: AI_VARIANT, provider }),
  ],
  [
    'copy_options',
    (x, provider) => ({
      project_id: x.projectId,
      variant_id: AI_VARIANT,
      layer_id: AI_TEXT,
      count: 3,
      provider,
    }),
  ],
  [
    'cut_out',
    (x, provider) => ({
      project_id: x.projectId,
      variant_id: AI_VARIANT,
      layer_id: AI_PICTURE,
      provider,
    }),
  ],
]

const denied = (message: string) => ({ code: 'AGENT_DENIED', message })

// Every reply text an agent was sent, for the word test at the end of each case.
function wordTest(x: RunSetUp, replies: ToolReply[]): void {
  const text = replies.map((reply) => JSON.stringify(reply)).join('\n')
  for (const word of ['comfyui', 'baseUrl', 'agentRuns', x.stand.origin, x.f.root]) {
    expect(text.includes(word), `${word} found in a reply`).toBe(false)
  }
  for (const reply of replies) {
    const item = reply.content?.find((i) => i.type === 'text')?.text ?? 'null'
    expect(riskyKeys(JSON.parse(item))).toEqual([])
  }
}

describe.each(TOOLS)('%s through the agent-run gate [P10-5, A-231]', (tool, args) => {
  it.each([
    ['unticked', { ticked: false }, 'fake', NOT_TICKED],
    ['with an unknown provider', {}, 'made-up-provider', UNKNOWN],
  ])('is refused %s, with no job row', async (_case, opts, provider, message) => {
    r = await runSetUp(opts)
    const reply = await r.s.call(tool, args(r, provider))
    expect(reply.isError).toBe(true)
    expect(refusalOf(reply)).toEqual(denied(message))
    expect(r.f.jobs()).toEqual([])
    wordTest(r, [reply])
  })

  it('is refused over the limit, with no new job row', async () => {
    r = await runSetUp()
    data(await r.f.user('agentRuns.setLimit', { limit: 1 }))
    setFakeBehaviour({ waitMs: 60_000 })
    const first = await r.s.call(tool, args(r, 'fake'))
    expect(first.isError).toBeFalsy()
    const second = await r.s.call(tool, args(r, 'fake'))
    expect(refusalOf(second)).toEqual(denied(OVER))
    expect(r.f.jobs()).toHaveLength(1)
    wordTest(r, [first, second])
  })

  it('two calls sent together run one at a time: one job and one refusal at the limit', async () => {
    r = await runSetUp()
    data(await r.f.user('agentRuns.setLimit', { limit: 1 }))
    setFakeBehaviour({ waitMs: 60_000 })
    const replies = await Promise.all([
      r.s.call(tool, args(r, 'fake')),
      r.s.call(tool, args(r, 'fake')),
    ])
    expect(replies.filter((x) => !x.isError)).toHaveLength(1)
    const refused = replies.filter((x) => x.isError).map(refusalOf)
    expect(refused).toEqual([denied(OVER)])
    expect(r.f.jobs()).toHaveLength(1)
  })

  it('ticked, gives only a job ID, and the job is one the agent started on the fake provider', async () => {
    r = await runSetUp()
    const reply = await r.s.call(tool, args(r, 'fake'))
    expect(reply.isError).toBeFalsy()
    expect(Object.keys(replyJson(reply))).toEqual(['jobId'])
    const jobId = startedId(reply)
    expect(r.f.job(jobId)).toMatchObject({ startedBy: 'agent', provider: 'fake', seenAt: null })
    const view = await jobReaches(r, jobId, ['succeeded', 'failed'])
    expect(view.status).toBe('succeeded')
    wordTest(r, [reply, await r.s.call('get_job', { project_id: r.projectId, job_id: jobId })])
  }, 25_000)
})

describe('get_job over a finished AI run [P10-5, A-232]', () => {
  const finished = async (tool: string) => {
    r = await runSetUp()
    const args = TOOLS.find(([name]) => name === tool)?.[1] ?? (() => ({}))
    const jobId = startedId(await r.s.call(tool, args(r, 'fake')))
    await jobReaches(r, jobId, ['succeeded', 'failed'])
    const reply = await r.s.call('get_job', { project_id: r.projectId, job_id: jobId })
    return { x: r, text: JSON.stringify(reply), view: await getJob(r, jobId) }
  }
  const HIDDEN = ['"request"', '"prompt"', '"model"', '"provider"', '"result"', '"options"']

  it('shows a layout as boxes of numbers, a key, an alignment and a colour', async () => {
    const { text, view } = await finished('propose_layout')
    const { layout } = view as unknown as { layout: { boxes: Array<Record<string, unknown>> } }
    expect(layout.boxes.map((b) => b.slot)).toEqual(['cta'])
    for (const box of layout.boxes) {
      expect(Object.keys(box).sort()).toEqual(
        ['align', 'color', 'fontSize', 'height', 'slot', 'typeStyle', 'width', 'x', 'y'].sort(),
      )
    }
    for (const word of HIDDEN) expect(text, word).not.toContain(word)
  }, 25_000)

  it('shows copy options as texts only', async () => {
    const { text, view } = await finished('copy_options')
    const { copyOptions } = view as unknown as { copyOptions: unknown[] }
    expect(copyOptions).toHaveLength(3)
    expect(copyOptions.every((o) => typeof o === 'string')).toBe(true)
    for (const word of HIDDEN) expect(text, word).not.toContain(word)
  }, 25_000)

  it("shows a cut-out's asset ID, and the asset exists", async () => {
    const { x, text, view } = await finished('cut_out')
    expect(view.assetIds).toHaveLength(1)
    expect(x.f.asset(view.assetIds[0] ?? '')).toMatchObject({ kind: 'image' })
    for (const word of [...HIDDEN, 'fake-cutout']) expect(text, word).not.toContain(word)
  }, 25_000)
})

describe('the published inputs of the AI tools [P10-5, S2-4]', () => {
  it('name no licence, and the descriptions name get_job (and update_layers for a layout)', async () => {
    r = await runSetUp()
    const listed = await r.s.list()
    for (const [tool] of TOOLS) {
      const row = listed.find((t) => t.name === tool)
      expect(row, tool).toBeDefined()
      expect(JSON.stringify(row?.inputSchema).toLowerCase()).not.toContain('licence')
      expect(row?.description).toContain('get_job')
    }
    expect(listed.find((t) => t.name === 'propose_layout')?.description).toContain('update_layers')
  })

  // P10-12 (security review of P10-5): BiRefNet ships with no licence note, so this case gives
  // it one for its own length and puts the real one back after.
  it('sending licence_confirmed: true to cut_out changes nothing: the licence refusal still comes back', async () => {
    r = await runSetUp()
    const x = r
    const real = birefnetCutout.licence
    const noted = { ...real, commercialNote: 'Needs a commercial licence' }
    Object.defineProperty(birefnetCutout, 'licence', { value: noted, configurable: true })
    try {
      const args = {
        project_id: x.projectId,
        variant_id: AI_VARIANT,
        layer_id: AI_PICTURE,
        provider: 'comfyui',
      }
      const refusals = []
      for (const extra of [{}, { licence_confirmed: true }, { licenceConfirmed: true }]) {
        const reply = await x.s.call('cut_out', { ...args, ...extra })
        expect(reply.isError).toBe(true)
        refusals.push(refusalOf(reply))
      }
      expect(refusals[0]).toEqual({
        code: 'INVALID_INPUT',
        message: licenceNotConfirmedMessage('BiRefNet'),
        details: { reason: 'licence_not_confirmed', workflow: 'birefnet-cutout' },
      })
      expect(refusals.slice(1)).toEqual([refusals[0], refusals[0]])
      expect(x.f.jobs()).toEqual([])
      expect(x.stand.seen.filter((q) => q.path === '/prompt')).toEqual([])
    } finally {
      Object.defineProperty(birefnetCutout, 'licence', { value: real, configurable: true })
    }
  })
})
