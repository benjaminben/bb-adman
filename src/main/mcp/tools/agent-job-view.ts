// What an agent sees of a job (MCP-D; spec/mcp-and-agents.md, get_job and list_jobs). Every
// field is named here, so a column added to the job row later does not leave through MCP.
// Left out: provider, model, remoteJobId, request and the rest of result (FR-198). A failed
// run is told in the app's own words, with no address and no server text.
import { fillMarks, plainMessage, reasonMessage } from '@/shared/providers/messages'
import {
  PROVIDER_ERROR_KINDS,
  type ProviderErrorKind,
  type ProviderInfo,
} from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

export type AgentJobView = Pick<
  JobRow,
  | 'id'
  | 'kind'
  | 'status'
  | 'startedBy'
  | 'campaignId'
  | 'variantId'
  | 'layerId'
  | 'slot'
  | 'progress'
  | 'paidCalls'
  | 'seenAt'
  | 'errorKind'
  | 'errorReason'
  | 'createdAt'
  | 'updatedAt'
> & {
  stage?: string
  queuePosition?: number
  assetIds: string[]
  failures?: Partial<Record<ProviderErrorKind, number>>
  message: string | null
}

type Labels = readonly Pick<ProviderInfo, 'id' | 'label'>[]

// The label when the row names a provider this build does not list. Never the raw ID.
const UNKNOWN_PROVIDER = 'The provider'

const KINDS: ReadonlySet<string> = new Set(PROVIDER_ERROR_KINDS)

const asObject = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

const isString = (v: unknown): v is string => typeof v === 'string'

function assetIdsOf(row: JobRow, result: Record<string, unknown>): string[] {
  if (row.kind === 'image_generation') {
    return Array.isArray(result.assetIds) ? result.assetIds.filter(isString) : []
  }
  if (row.kind === 'video_generation') return isString(result.assetId) ? [result.assetId] : []
  return []
}

function failuresOf(result: Record<string, unknown>): Partial<Record<ProviderErrorKind, number>> {
  const counts: Partial<Record<ProviderErrorKind, number>> = {}
  for (const [kind, n] of Object.entries(asObject(result.failures))) {
    if (KINDS.has(kind) && Number.isInteger(n)) counts[kind as ProviderErrorKind] = n as number
  }
  return counts
}

// P4-5 (OI-68): a local reason's {provider} is the registry label too.
function messageOf(row: JobRow, providers: Labels): string | null {
  const label = providers.find((p) => p.id === row.provider)?.label
  if (row.errorReason) {
    return fillMarks(reasonMessage(row.errorReason), {
      address: 'the saved ComfyUI address',
      ...(label !== undefined && { provider: label }),
    })
  }
  if (row.errorKind) return plainMessage(row.errorKind, label ?? UNKNOWN_PROVIDER)
  return null
}

export function agentJobView(row: JobRow, providers: Labels): AgentJobView {
  const result = asObject(row.result)
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    startedBy: row.startedBy,
    campaignId: row.campaignId,
    variantId: row.variantId,
    layerId: row.layerId,
    slot: row.slot,
    progress: row.progress,
    paidCalls: row.paidCalls,
    seenAt: row.seenAt,
    errorKind: row.errorKind,
    errorReason: row.errorReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(isString(result.stage) && { stage: result.stage }),
    ...(Number.isInteger(result.queuePosition) && {
      queuePosition: result.queuePosition as number,
    }),
    assetIds: assetIdsOf(row, result),
    ...(row.kind === 'image_generation' && { failures: failuresOf(result) }),
    message: messageOf(row, providers),
  }
}
