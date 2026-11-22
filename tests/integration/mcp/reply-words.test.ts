// The word test (spec/agent-runs.md "Tests that must exist"; MCP-G, security class). Every MCP
// tool's output schema and a recorded reply of each tool, success and refusal, over the real
// HTTP door with the ComfyUI stand-in: none holds `comfyui` (case-sensitive), `baseUrl`,
// `agentRuns`, or the stand-in's address.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { BUILT_TOOLS } from './tool-client'
import { imageArgs, runSetUp, startedId, type RunSetUp } from './run-tools-fixture'

let r: RunSetUp | undefined
afterEach(async () => {
  await r?.close()
  r = undefined
})

type Call = { tool: string; args: unknown; ok: boolean }

// Each tool once with arguments it takes and at least once with arguments it refuses.
function calls(x: RunSetUp, ids: { agentJob: string; userJob: string; campaign: string }): Call[] {
  const p = x.projectId
  const other = { project_id: 'made-up-project' }
  const input = createInput()
  const video = {
    project_id: p,
    variant_id: 'v1',
    prompt: 'A bottle on a rock',
    duration_ms: 2_000,
    provider: 'comfyui',
    start: 'none',
    use_references: false,
    reference_asset_ids: [],
  }
  const table: Array<[string, unknown, unknown[]]> = [
    ['list_projects', {}, [7]],
    ['get_project', { project_id: p }, [other]],
    ['list_assets', { project_id: p }, [other]],
    [
      'get_campaign',
      { project_id: p, campaign_id: ids.campaign },
      [{ project_id: p, campaign_id: 'x' }],
    ],
    [
      'create_campaign',
      {
        project_id: p,
        brief: input.brief,
        // The subjects the user's campaign made in setup.
        subject_map: input.subjectMap.map((m) => ({ ...m, create: false })),
        languages: input.languages,
        sizes: input.sizes,
        template_id: input.templateId,
      },
      [{ ...other, brief: input.brief }],
    ],
    ['get_slots', { project_id: p, campaign_id: 'c1' }, [{ project_id: p, campaign_id: 'x' }]],
    ['get_job', { project_id: p, job_id: ids.agentJob }, [{ project_id: p, job_id: 'x' }]],
    ['list_jobs', { project_id: p }, [other]],
    [
      'generate_images',
      imageArgs(x),
      [
        imageArgs(x, { provider: 'gemini' }),
        imageArgs(x, { provider: 'made-up-provider' }),
        imageArgs(x, { slot: 'headline' }),
        imageArgs(x, { reference_asset_ids: ['made-up-asset'] }),
      ],
    ],
    [
      'generate_video',
      video,
      [
        { ...video, start: 'first_frame' },
        { ...video, duration_ms: 600_000 },
        { ...video, provider: 'gemini' },
      ],
    ],
    [
      'cancel_job',
      { project_id: p, job_id: ids.agentJob },
      [
        { project_id: p, job_id: ids.userJob },
        { project_id: p, job_id: 'x' },
      ],
    ],
    // P10-2: the two read tools.
    ['list_subjects', { project_id: p }, [other]],
    ['get_variant', { project_id: p, variant_id: 'v1' }, [{ project_id: p, variant_id: 'x' }]],
  ]
  return table.flatMap(([tool, good, bad]) => [
    { tool, args: good, ok: true },
    ...bad.map((args) => ({ tool, args, ok: false })),
  ])
}

describe('no tool reply or output schema holds a provider ID, a settings key or the address [MCP-G; FR-198]', () => {
  it('holds for a success and a refusal of each of the 11 tools', async () => {
    r = await runSetUp()
    const x = r
    const agentJob = startedId(await x.s.call('generate_images', imageArgs(x)))
    const userJob = data<{ jobId: string }>(await x.f.run({})).jobId
    const made = await x.f.user('campaign.create', createInput())
    const campaign = data<{ campaignId: string }>(made).campaignId
    const listed = await x.s.list()
    expect(listed.map((t) => t.name)).toEqual(BUILT_TOOLS)
    const schemas = listed.map((t) => (t as { outputSchema?: unknown }).outputSchema ?? null)
    const seen: string[] = schemas.map((schema) => JSON.stringify(schema))
    const outcomes = new Map<string, Set<boolean>>()
    for (const c of calls(x, { agentJob, userJob, campaign })) {
      const reply = await x.s.call(c.tool, c.args)
      expect(Boolean(reply.isError), `${c.tool} ${JSON.stringify(c.args)}`).toBe(!c.ok)
      outcomes.set(c.tool, (outcomes.get(c.tool) ?? new Set()).add(c.ok))
      seen.push(JSON.stringify(reply))
    }
    expect([...outcomes.keys()]).toEqual(BUILT_TOOLS)
    for (const [tool, both] of outcomes) expect(both.size, tool).toBe(2)
    const text = seen.join('\n')
    expect(text).toContain(agentJob)
    expect(text).toContain('AGENT_DENIED')
    for (const word of ['comfyui', 'baseUrl', 'agentRuns', x.stand.origin, `:${x.stand.port}`]) {
      expect(text.includes(word), `${word} found in a reply`).toBe(false)
    }
  }, 25_000)
})
