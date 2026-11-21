// The sync plan (spec/links-and-sync.md, "Sync"; spec/data-rules.md [FR-082, FR-083]): what
// syncing a direction would change, and the rows an accepted choice writes. Pure: plain rows
// and sizes, never a database or a clock. No IDs are made here; the caller adds them.
import type { Size } from '@/shared/scene/background-placement'
import type { LayerValues, SyncDecision } from '@/shared/schemas/links'
import type { SyncChange, SyncPreview } from '@/shared/schemas/queries/sync'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { AppError } from '@/shared/schemas/result'
import { GROUPS, followRule, groupOfPath, type Group, type RuleFacts } from './follow-rules'
import { staleGroups } from './out-of-date'
import { planVariant, type PlannedLayer } from './fan-out-plan'

export type SyncVariant = { row: RuleFacts & { id: string }; layers: LayerRow[] }
export type SyncPlanInput = {
  master: SyncVariant
  variants: SyncVariant[] // in campaign.get order; the master, if listed, is skipped
  pictureSizes: Record<string, Size> // asset ID to pixel size, for an added background
}

export type LayerPatch = Partial<
  LayerValues &
    Pick<LayerRow, 'overrides' | 'syncedRevs' | 'translationStatus' | 'translationSource'>
>
export type VariantWrites = {
  variantId: string
  updates: Array<{ layerId: string; patch: LayerPatch }>
  adds: PlannedLayer[] // `z` already one above the variant's top layer (A-148)
  removes: string[] // layer IDs
}

const NO_MATCH = 'A sync choice does not match the changes.'

// The master's value for a group, with the layer's override paths in it kept as the layer has
// them, except the paths in `take`: a whole-group path keeps the whole value, `group.field`
// keeps that field.
function valueAfter(group: Group, from: LayerRow, layer: LayerRow, take: Set<string>): unknown {
  const kept = layer.overrides.filter((p) => groupOfPath(p) === group && !take.has(p))
  if (kept.includes(group)) return structuredClone(layer[group])
  const master = from[group]
  if (kept.length === 0 || master === null || typeof master !== 'object') {
    return structuredClone(master)
  }
  const value = structuredClone(master) as Record<string, unknown>
  const own = layer[group] as Record<string, unknown> | null
  for (const path of kept) {
    const field = path.slice(group.length + 1)
    if (own && field in own) value[field] = structuredClone(own[field])
    else delete value[field]
  }
  return value
}

type Update = { change: SyncChange; follows: Group[]; translation: boolean }

function updateOf(from: LayerRow, layer: LayerRow, master: RuleFacts, row: RuleFacts) {
  const rule = (g: Group) => followRule(g, master, row)
  const groups = staleGroups(from, layer, rule)
  if (groups.length === 0) return null
  const follows = groups.filter((g) => rule(g) === 'follows')
  const translation = groups.some((g) => rule(g) === 'translation')
  const proposed: Record<string, unknown> = {}
  for (const g of follows) proposed[g] = valueAfter(g, from, layer, new Set())
  const change: SyncChange = {
    layerKey: layer.key,
    layerName: from.name,
    kind: 'update',
    groups,
    proposed: proposed as Partial<LayerValues>,
    blockedByOverride: layer.overrides.filter((p) => {
      const g = groupOfPath(p)
      return g !== null && follows.includes(g)
    }),
  }
  // Phase 5 stand-in (A-134): no translation job yet, so the current text, failed.
  if (translation) change.proposedTranslation = { text: layer.copy ?? '', status: 'failed' }
  return { change, follows, translation } satisfies Update
}

function planAdd(input: SyncPlanInput, from: LayerRow, row: RuleFacts): PlannedLayer {
  const size = from.source ? (input.pictureSizes[from.source.assetId] ?? null) : null
  const [planned] = planVariant({
    master: input.master.row,
    masterLayers: [from],
    target: row,
    pictureSize: size,
  })
  if (!planned) throw new Error('sync-plan: planVariant gave no layer')
  return planned
}

const valuesOf = (l: PlannedLayer): LayerValues => {
  const { copy, style, geometry, source, timing, animation } = l
  return { copy, style, geometry, source, timing, animation }
}

type Planned = { change: SyncChange; update?: Update; layer?: LayerRow; add?: PlannedLayer }

function planOf(input: SyncPlanInput, variant: SyncVariant): Planned[] {
  const master = input.master
  const byKey = new Map(variant.layers.map((l) => [l.key, l]))
  const keys = new Set(master.layers.map((l) => l.key))
  const out: Planned[] = []
  for (const from of master.layers) {
    const layer = byKey.get(from.key)
    if (!layer) {
      const add = planAdd(input, from, variant.row)
      const change: SyncChange = {
        layerKey: from.key,
        layerName: from.name,
        kind: 'add-layer',
        groups: [...GROUPS],
        proposed: valuesOf(add),
        blockedByOverride: [],
      }
      out.push({ change, add })
      continue
    }
    const update = updateOf(from, layer, master.row, variant.row)
    if (update) out.push({ change: update.change, update, layer })
  }
  for (const layer of variant.layers) {
    if (!layer.linked || keys.has(layer.key)) continue
    const change: SyncChange = {
      layerKey: layer.key,
      layerName: layer.name,
      kind: 'remove-layer',
      groups: [],
      proposed: {},
      blockedByOverride: [],
    }
    out.push({ change, layer })
  }
  return out
}

function plansOf(input: SyncPlanInput): Array<{ variant: SyncVariant; planned: Planned[] }> {
  return input.variants
    .filter((v) => v.row.id !== input.master.row.id)
    .map((variant) => ({ variant, planned: planOf(input, variant) }))
    .filter((p) => p.planned.length > 0)
}

// Only the variants with something to change, in the order given.
export function syncPreviewOf(input: SyncPlanInput): SyncPreview[] {
  return plansOf(input).map(({ variant, planned }) => ({
    variantId: variant.row.id,
    changes: planned.map((p) => p.change),
  }))
}

function patchOf(p: Planned, decision: SyncDecision, from: LayerRow): LayerPatch {
  const layer = p.layer as LayerRow
  const { follows, translation, change } = p.update as Update
  const take = new Set(
    decision.overrides
      .filter((o) => o.choice === 'take-master' && change.blockedByOverride.includes(o.path))
      .map((o) => o.path),
  )
  const patch: Record<string, unknown> = {
    overrides: layer.overrides.filter((path) => !take.has(path)),
    syncedRevs: { ...from.revs },
  }
  for (const g of follows) patch[g] = valueAfter(g, from, layer, take)
  if (translation) Object.assign(patch, { translationStatus: 'missing', translationSource: null })
  return patch as LayerPatch
}

// The rows the accepted decisions write, per variant written, worked out from the rows given
// (never from the window). A refused change or one with no decision writes nothing.
export function syncWritesOf(input: SyncPlanInput, decisions: SyncDecision[]): VariantWrites[] {
  const plans = new Map(plansOf(input).map((p) => [p.variant.row.id, p]))
  const masterByKey = new Map(input.master.layers.map((l) => [l.key, l]))
  const seen = new Set<string>()
  const writes = new Map<string, VariantWrites>()
  for (const d of decisions) {
    const plan = plans.get(d.variantId)
    const p = plan?.planned.find((x) => x.change.layerKey === d.layerKey)
    const id = JSON.stringify([d.variantId, d.layerKey])
    if (!plan || !p || seen.has(id)) throw new AppError('INVALID_INPUT', NO_MATCH)
    seen.add(id)
    if (!d.accept) continue
    const w = writes.get(d.variantId) ?? {
      variantId: d.variantId,
      updates: [],
      adds: [],
      removes: [],
    }
    writes.set(d.variantId, w)
    if (p.change.kind === 'remove-layer') w.removes.push((p.layer as LayerRow).id)
    else if (p.add) w.adds.push(p.add)
    else {
      const from = masterByKey.get(d.layerKey) as LayerRow
      w.updates.push({ layerId: (p.layer as LayerRow).id, patch: patchOf(p, d, from) })
    }
  }
  return [...writes.values()].map((w) => stackAdds(w, plans.get(w.variantId)?.variant))
}

// Each added layer goes one above the variant's top layer, in the order accepted (A-148).
function stackAdds(w: VariantWrites, variant: SyncVariant | undefined): VariantWrites {
  let top = Math.max(-1, ...(variant?.layers ?? []).map((l) => l.z))
  return { ...w, adds: w.adds.map((l) => ({ ...l, z: ++top })) }
}
