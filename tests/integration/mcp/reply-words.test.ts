// The word test (spec/agent-runs.md "Tests that must exist"; MCP-G, security class). Every MCP
// tool's output schema and a recorded reply of each tool, success and refusal, over the real
// HTTP door with the ComfyUI stand-in: none holds `comfyui` (case-sensitive), `baseUrl`,
// `agentRuns`, or the stand-in's address.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { BUILT_TOOLS } from './tool-client'
import { imageArgs, runSetUp, startedId, type RunSetUp } from './run-tools-fixture'
import { seedTranslation } from './translation-check-fixture'
import { fixtureText } from '../../fixtures/comfy-custom/load'

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
      [
        { ...other, brief: input.brief },
        // P10-10: no sizes and no languages, and a region not in the table.
        {
          project_id: p,
          brief: { ...input.brief, region: 'Atlantis' },
          subject_map: input.subjectMap.map((m) => ({ ...m, create: false })),
          template_id: input.templateId,
        },
      ],
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
    // P10-3: the drawn picture.
    ['render_variant', { project_id: p, variant_id: 'v1' }, [{ project_id: p, variant_id: 'x' }]],
    // P10-4: the layer tools, over the seeded variants v1 and v2.
    [
      'create_layer',
      { project_id: p, variant_id: 'v2', type: 'text' },
      [{ project_id: p, variant_id: 'x', type: 'text' }],
    ],
    [
      'update_layer',
      { project_id: p, layer_id: 'l-text', patch: { copy: 'Stay cool' } },
      [{ project_id: p, layer_id: 'x', patch: { copy: 'Stay cool' } }],
    ],
    [
      'update_layers',
      {
        project_id: p,
        variant_id: 'v1',
        updates: [{ layerId: 'l-text', patch: { visible: false } }],
      },
      [{ project_id: p, variant_id: 'v1', updates: [{ layerId: 'x', patch: { visible: false } }] }],
    ],
    ['delete_layer', { project_id: p, layer_id: 'l-other' }, [{ project_id: p, layer_id: 'l-bg' }]],
    [
      'reorder_layers',
      { project_id: p, variant_id: 'v1', layer_ids: ['l-text'] },
      [{ project_id: p, variant_id: 'v1', layer_ids: [] }],
    ],
    // P10-5: the AI tools, on the fake provider, over variant v-ai of ai-tools-fixture.ts.
    [
      'propose_layout',
      { project_id: p, variant_id: 'v-ai', provider: 'fake' },
      [
        { project_id: p, variant_id: 'v-ai', provider: 'gemini' },
        { project_id: p, variant_id: 'x', provider: 'fake' },
      ],
    ],
    [
      'copy_options',
      { project_id: p, variant_id: 'v-ai', layer_id: 'l-ai-cta', count: 2, provider: 'fake' },
      [{ project_id: p, variant_id: 'v1', layer_id: 'l-text', count: 2, provider: 'fake' }],
    ],
    [
      'cut_out',
      { project_id: p, variant_id: 'v-ai', layer_id: 'l-ai-picture', provider: 'fake' },
      [
        { project_id: p, variant_id: 'v-ai', layer_id: 'l-ai-picture', provider: 'made-up' },
        { project_id: p, variant_id: 'v1', layer_id: 'l-text', provider: 'fake' },
      ],
    ],
    // P10-6: this core refuses every ask, so its success reply is word-tested in ask-flow.test.ts.
    ['delete_campaign', null, [{ project_id: p, campaign_id: ids.campaign }]],
    // P10-11: a cell of the seeded direction d1 (the master's size, the campaign's language);
    // delete_variant asks, so it is refused here and word-tested in variant-edit-tools.test.ts.
    [
      'add_variant',
      { project_id: p, direction_id: 'd1', size_label: '4:5', language: 'en-US', format: 'image' },
      [{ project_id: p, direction_id: 'x', size_label: '4:5', language: 'en-US', format: 'image' }],
    ],
    ['delete_variant', null, [{ project_id: p, variant_id: 'v2' }]],
    // P10-12: over a de translation seeded beside v1 (translation-check-fixture.ts).
    [
      'set_translation',
      {
        project_id: p,
        layer_id: seedTranslation(x.f.db),
        text: 'Kühl bleiben',
        apply_to_same_language: true,
      },
      [{ project_id: p, layer_id: 'x', text: 'Hallo', apply_to_same_language: false }],
    ],
    [
      'run_checks',
      { project_id: p, campaign_id: ids.campaign },
      [{ project_id: p, campaign_id: 'x' }],
    ],
    [
      'get_check_results',
      { project_id: p, campaign_id: ids.campaign },
      [{ project_id: p, campaign_id: ids.campaign, variant_ids: ['v1'] }],
    ],
    // P10-13: the format change, on the seeded variant v2.
    [
      'set_variant_format',
      { project_id: p, variant_id: 'v2', format: 'video' },
      [{ project_id: p, variant_id: 'x', format: 'video' }],
    ],
    // R2P-5: this core refuses every ask, so its success reply is word-tested in
    // import-assets-checks.test.ts; a relative path is refused before the ask.
    ['import_assets', null, [{ project_id: p, paths: ['Pictures/hero.png'] }]],
    // R2P-7: a Markdown brief with no picture; a relative picture is refused with no ask.
    [
      'create_campaign_from_brief',
      { project_id: p, text: '# Tea\nRegion: US\nAudience: All\nMessage: Hi\n## Subjects\n- Tin' },
      [
        {
          project_id: p,
          text: '# Tea\nRegion: US\nAudience: All\nMessage: Hi\n## Subjects\n### Tin\nPicture: a.png',
        },
      ],
    ],
    // R2P-8: a new project in the default folder; a reserved Windows name is refused.
    ['create_project', { name: 'Autumn Work' }, [{ name: 'CON' }]],
    // SUBJ-1: delete_subject asks, so it is refused here and word-tested in
    // delete-subject-tool.test.ts.
    ['delete_subject', null, [{ project_id: p, subject_id: 'can' }]],
    // CW-6a: the workflow tools. add and remove ask, so this core refuses them; their success
    // replies are not word-tested: workflow-tools.test.ts checks their keys are exactly
    // ['workflowId'] (add) and their value is the workflow ID only (remove).
    ['list_comfy_workflows', {}, [7]],
    [
      'add_comfy_workflow',
      null,
      [{ name: 'Board', workflow_json: fixtureText('canvas') }, { name: 'Board' }],
    ],
    ['remove_comfy_workflow', null, [{ workflow_id: 'custom-0123456789ab' }, { workflow_id: 'x' }]],
  ]
  return table.flatMap(([tool, good, bad]) => [
    ...(good === null ? [] : [{ tool, args: good, ok: true }]),
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
    for (const [tool, both] of outcomes) {
      expect(both.size, tool).toBe(
        [
          'delete_campaign',
          'delete_variant',
          'import_assets',
          'delete_subject',
          'add_comfy_workflow',
          'remove_comfy_workflow',
        ].includes(tool)
          ? 1
          : 2,
      )
    }
    const text = seen.join('\n')
    expect(text).toContain(agentJob)
    expect(text).toContain('AGENT_DENIED')
    for (const word of ['comfyui', 'baseUrl', 'agentRuns', x.stand.origin, `:${x.stand.port}`]) {
      expect(text.includes(word), `${word} found in a reply`).toBe(false)
    }
  }, 25_000)
})
