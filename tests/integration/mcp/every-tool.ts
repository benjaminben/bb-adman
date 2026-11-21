// Calls every tool the server lists, with good and bad arguments, and gives each raw reply.
// Used by the secret-leak test (SPEC 10.1; FR-198). Not a test file.
import { createInput } from '../campaigns/campaign-fixture'
import { toolSession } from './tool-client'

export async function callEveryTool(
  port: number,
  token: string,
  ids: { projectId: string; campaignId: string },
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
  }
  const replies: string[] = []
  for (const name of names) {
    for (const args of [good, {}, { ...good, project_id: 'made-up-project' }, { project_id: 7 }]) {
      replies.push(await s.raw(name, args))
    }
  }
  return { names, replies }
}
