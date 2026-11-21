// spec/screens-variants.md, "Sync review": the decisions "Accept all" and "Accept selected"
// send. Each blocked path goes with its radio's choice; a path with no choice is "keep-mine",
// the default. Pure.
import type { SyncDecision } from '@/shared/schemas/links'
import type { SyncChange, SyncPreview } from '@/shared/schemas/queries/sync'

export type Choice = 'keep-mine' | 'take-master'
export type Choices = Record<string, Choice>

// JSON keys, so two IDs never run together into the same text.
export const changeKey = (variantId: string, layerKey: string) =>
  JSON.stringify([variantId, layerKey])
export const choiceKey = (variantId: string, layerKey: string, path: string) =>
  JSON.stringify([variantId, layerKey, path])

function decisionOf(variantId: string, change: SyncChange, choices: Choices): SyncDecision {
  return {
    variantId,
    layerKey: change.layerKey,
    accept: true,
    overrides: change.blockedByOverride.map((path) => ({
      path,
      choice: choices[choiceKey(variantId, change.layerKey, path)] ?? 'keep-mine',
    })),
  }
}

function decisionsOf(
  variants: readonly SyncPreview[],
  choices: Choices,
  keep: (variantId: string, change: SyncChange) => boolean,
): SyncDecision[] {
  return variants.flatMap((v) =>
    v.changes.filter((c) => keep(v.variantId, c)).map((c) => decisionOf(v.variantId, c, choices)),
  )
}

export function acceptAll(variants: readonly SyncPreview[], choices: Choices): SyncDecision[] {
  return decisionsOf(variants, choices, () => true)
}

export function acceptSelected(
  variants: readonly SyncPreview[],
  ticked: ReadonlySet<string>,
  choices: Choices,
): SyncDecision[] {
  return decisionsOf(variants, choices, (id, c) => ticked.has(changeKey(id, c.layerKey)))
}
