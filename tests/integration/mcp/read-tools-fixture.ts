// MCP-D: a project with one campaign, MCP on, and a tool session; and job rows written as a
// run would leave them, with every column filled. Not a test file.
import { data } from '../core-fixture'
import { makeMcpFixture, type McpFixture } from './mcp-fixture'
import { toolSession, type ToolSession } from './tool-client'
import { createInput } from '../campaigns/campaign-fixture'

export type ReadSetUp = {
  fx: McpFixture
  projectId: string
  campaignId: string
  variantId: string
  s: ToolSession
}

// A campaign with every optional brief and rule set field filled.
function fullInput() {
  const base = createInput()
  return {
    ...base,
    brief: {
      ...base.brief,
      subjects: [
        { id: 'can', name: 'Can', description: 'A red can' },
        { id: 'bottle', name: 'Bottle', description: 'A green bottle' },
      ],
      offer: 'Two for one',
      callToAction: 'Buy now',
      tone: 'Bright',
      languages: ['en', 'de'],
      sizes: ['1x1', '9x16'],
      copy: { en: { headline: 'Stay cool', callToAction: 'Buy now' } },
    },
    ruleSet: {
      requiredAssetIds: [],
      palette: ['#FF0000'],
      requiredWords: { en: ['fresh'] },
      prohibitedWords: { en: ['cheap'] },
    },
  }
}

export async function readSetUp(): Promise<ReadSetUp> {
  const fx = await makeMcpFixture()
  const { projectId } = data<{ projectId: string }>(
    await fx.user('project.create', { name: 'Reads', location: fx.projectsDir }),
  )
  const made = data<{ campaignId: string; variantId: string }>(
    await fx.user('campaign.create', { projectId, ...fullInput() }),
  )
  data(await fx.user('mcp.setEnabled', { enabled: true }))
  const s = await toolSession(fx.port, await fx.token())
  return { fx, projectId, campaignId: made.campaignId, variantId: made.variantId, s }
}

export type JobValues = {
  id: string
  kind?: string
  status?: string
  campaignId?: string | null
  variantId?: string | null
  createdAt?: string
  result?: unknown
  errorKind?: string | null
  errorReason?: string | null
  detail?: string
}

// A made-up missing-items list and an address in `result`, a model, a remote ID and a
// request: none of them may reach an agent.
export const HIDDEN_RESULT = {
  assetIds: ['a1', 'a2'],
  failures: { offline: 1 },
  stage: 'waiting',
  queuePosition: 2,
  missingItems: [{ what: 'model', name: 'made-up-model.safetensors' }],
  serverAddress: 'http://made-up-host.example:8188',
}

export function insertJob(r: ReadSetUp, v: JobValues): void {
  r.fx.core.projects
    .requireOpen(r.projectId)
    .db.prepare(
      `INSERT INTO job (id, kind, status, campaign_id, variant_id, layer_id, slot, provider,
        model, request, remote_job_id, result, error_kind, error_reason, error_detail,
        progress, paid_calls, seen_at, started_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'l1', 'background', 'comfyui', 'made-up-model-name', ?,
        'made-up-remote-id', ?, ?, ?, ?, 0.5, 1, '2026-01-01T00:00:09Z', 'agent', ?, ?)`,
    )
    .run(
      v.id,
      v.kind ?? 'image_generation',
      v.status ?? 'failed',
      v.campaignId === undefined ? r.campaignId : v.campaignId,
      v.variantId === undefined ? r.variantId : v.variantId,
      JSON.stringify({ prompt: 'A can', referencePath: '/Users/made-up/picture.png' }),
      JSON.stringify(v.result ?? HIDDEN_RESULT),
      v.errorKind === undefined ? 'offline' : v.errorKind,
      v.errorReason === undefined ? 'no_answer' : v.errorReason,
      v.detail ?? 'made-up detail words',
      v.createdAt ?? '2026-01-01T00:00:00Z',
      v.createdAt ?? '2026-01-01T00:00:00Z',
    )
}

// The keys an agent may see of a job (spec/mcp-and-agents.md, agentJobView).
export const JOB_VIEW_KEYS = new Set([
  'id',
  'kind',
  'status',
  'startedBy',
  'campaignId',
  'variantId',
  'layerId',
  'slot',
  'progress',
  'paidCalls',
  'seenAt',
  'errorKind',
  'errorReason',
  'createdAt',
  'updatedAt',
  'stage',
  'queuePosition',
  'assetIds',
  'failures',
  'message',
])

// Every object key at any depth, skipping the values of the named record keys (data).
export function allKeys(value: unknown, records: ReadonlySet<string> = new Set()): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => allKeys(v, records))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => [
    k,
    ...(records.has(k) ? [] : allKeys(v, records)),
  ])
}
