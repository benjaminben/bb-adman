// Calls every tool the server lists, with good and bad arguments, and gives each raw reply.
// Used by the secret-leak test (SPEC 10.1; FR-198). Not a test file.
import { createInput } from '../campaigns/campaign-fixture'
import { toolSession } from './tool-client'
import { fixtureText } from '../../fixtures/comfy-custom/load'

// R2P-5: a made-up full path given to import_assets, which no reply may hold.
export const PLANTED_IMPORT_PATH = '/made-up-agent-folder/made-up-agent-import.png'

// CW-6a: a marker put in every kind of text a graph holds, which no reply may hold.
export const PLANTED_GRAPH_MARKER = 'QX7GRAPHMARKER'

// The picture fixture with the marker in a node ID, a class name, an input and a title, so it
// still passes the file checks.
export function markedGraphText(): string {
  const graph = JSON.parse(fixtureText('picture')) as Record<string, unknown>
  graph[`${PLANTED_GRAPH_MARKER}-node`] = {
    class_type: `${PLANTED_GRAPH_MARKER}Class`,
    inputs: {
      [`${PLANTED_GRAPH_MARKER}_input`]: `${PLANTED_GRAPH_MARKER} value`,
      images: ['8', 0],
    },
    _meta: { title: `${PLANTED_GRAPH_MARKER} title` },
  }
  return JSON.stringify(graph)
}

export async function callEveryTool(
  port: number,
  token: string,
  ids: { projectId: string; campaignId: string; workflowId?: string },
): Promise<{ names: string[]; replies: string[] }> {
  const s = await toolSession(port, token)
  const names = (await s.list()).map((t) => t.name)
  const input = createInput()
  // One set of arguments holds what any listed tool takes; each tool drops the rest.
  const good = {
    project_id: ids.projectId,
    campaign_id: ids.campaignId,
    brief: input.brief,
    subject_map: input.subjectMap,
    languages: input.languages,
    sizes: input.sizes,
    template_id: input.templateId,
    // MCP-G: the start and cancel tools; 'a1' is the planted asset with a path.
    variant_id: 'made-up-variant',
    slot: 'background',
    prompt: 'A red can on a rock',
    reference_asset_ids: ['a1'],
    count: 1,
    provider: 'comfyui',
    duration_ms: 2_000,
    start: 'none',
    use_references: true,
    job_id: 'made-up-job',
    // Phase 10 (P10-1): the keys the new tools take.
    layer_id: 'made-up-layer',
    layer_ids: ['made-up-layer'],
    values: { name: 'Made-up layer' },
    patch: { name: 'Made-up layer' },
    updates: [{ layerId: 'made-up-layer', patch: { name: 'Made-up layer' } }],
    type: 'text',
    max_dimension: 256,
    direction_id: 'made-up-direction',
    master_variant_id: 'made-up-variant',
    size_label: '1x1',
    language: 'en',
    format: 'image',
    text: 'Made-up words',
    apply_to_same_language: false,
    variant_ids: ['made-up-variant'],
    request_id: 'made-up-request',
    // R2P-5: import_assets; the path is planted, and the secret-leak test looks for it.
    paths: [PLANTED_IMPORT_PATH],
    library: 'asset',
    // R2P-8: create_project; a made-up name, made in the default projects folder.
    name: 'Made-up agent project',
    // CW-6a: the workflow tools; the graph holds the planted marker.
    workflow_json: markedGraphText(),
    workflow_id: ids.workflowId ?? 'custom-0123456789ab',
  }
  const replies: string[] = []
  for (const name of names) {
    for (const args of [good, {}, { ...good, project_id: 'made-up-project' }, { project_id: 7 }]) {
      replies.push(await s.raw(name, args))
    }
  }
  return { names, replies }
}
