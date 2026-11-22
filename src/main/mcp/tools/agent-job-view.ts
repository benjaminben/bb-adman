// What an agent sees of a job (MCP-D; spec/mcp-and-agents.md, get_job and list_jobs). Every
// field is named here, so a column added to the job row later does not leave through MCP.
// Left out: provider, model, remoteJobId, request and the rest of result (FR-198). A failed
// run is told in the app's own words, with no address and no server text. P10-5 (A-232): a
// succeeded layout run gives its boxes, a succeeded copy run its option texts. R2E-3 (round-2-
// editor.md D3): a box also gives its text box colour and padding and its type style, when set.
import { fillMarks, plainMessage, reasonMessage } from '@/shared/providers/messages'
import {
  PROVIDER_ERROR_KINDS,
  type ProviderErrorKind,
  type ProviderInfo,
} from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { MAX_COPY_OPTIONS } from '@/shared/config/copy-options'
import { isTypeStyleId, type TypeStyleId } from '@/shared/config/type-styles'

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
  layout?: { boxes: LayoutBoxView[] }
  copyOptions?: string[]
  failures?: Partial<Record<ProviderErrorKind, number>>
  message: string | null
}

export type LayoutBoxView = {
  slot: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  align: 'left' | 'center' | 'right'
  color: string | null
  boxColor?: string
  boxPadding?: number
  typeStyle?: TypeStyleId | null
}

type Labels = readonly Pick<ProviderInfo, 'id' | 'label'>[]

// The label when the row names a provider this build does not list. Never the raw ID.
const UNKNOWN_PROVIDER = 'The provider'

const KINDS: ReadonlySet<string> = new Set(PROVIDER_ERROR_KINDS)

const asObject = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

const isString = (v: unknown): v is string => typeof v === 'string'

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isString) : [])

function assetIdsOf(row: JobRow, result: Record<string, unknown>): string[] {
  if (row.kind === 'image_generation' || row.kind === 'cutout') return strings(result.assetIds)
  if (row.kind === 'video_generation') return isString(result.assetId) ? [result.assetId] : []
  return []
}

const ALIGNS: ReadonlySet<unknown> = new Set(['left', 'center', 'right'])
const isAlign = (v: unknown): v is LayoutBoxView['align'] => ALIGNS.has(v)
const isHex = (v: unknown): v is string => isString(v) && /^#[0-9a-f]{6}$/i.test(v)
const isColor = (v: unknown): v is string | null => v === null || isHex(v)

// R2E-3: the three look fields, each only when it holds a plain value of its kind.
function lookOf(b: Record<string, unknown>): Partial<LayoutBoxView> {
  const { boxColor, boxPadding, typeStyle } = b
  return {
    ...(isHex(boxColor) && { boxColor }),
    ...(Number.isInteger(boxPadding) &&
      (boxPadding as number) >= 0 && {
        boxPadding: boxPadding as number,
      }),
    ...((typeStyle === null || isTypeStyleId(typeStyle)) && { typeStyle }),
  }
}

// The longest copy option an agent is given, in code points (P10-12, review of P10-5).
const MAX_OPTION_CHARS = 200

const copyOptionsOf = (result: Record<string, unknown>): string[] =>
  strings(result.options)
    .slice(0, MAX_COPY_OPTIONS)
    .map((text) => [...text].slice(0, MAX_OPTION_CHARS).join(''))

// Each box by its eight named fields; a box with a field of the wrong type is left out. align
// is one of the three, color a 6-digit hex or null. The look fields are added when valid.
function boxOf(v: unknown): LayoutBoxView[] {
  const b = asObject(v)
  const { slot, x, y, width, height, fontSize, align, color } = b
  if (!isString(slot) || !isAlign(align) || !isColor(color)) return []
  if (!isNumber(x) || !isNumber(y) || !isNumber(width) || !isNumber(height)) return []
  if (!isNumber(fontSize)) return []
  return [{ slot, x, y, width, height, fontSize, align, color, ...lookOf(b) }]
}

const boxesOf = (result: Record<string, unknown>): LayoutBoxView[] =>
  Array.isArray(result.boxes) ? result.boxes.flatMap(boxOf) : []

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
  const done = row.status === 'succeeded'
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
    ...(done && row.kind === 'layout_proposal' && { layout: { boxes: boxesOf(result) } }),
    ...(done && row.kind === 'copy_options' && { copyOptions: copyOptionsOf(result) }),
    ...(row.kind === 'image_generation' && { failures: failuresOf(result) }),
    message: messageOf(row, providers),
  }
}
