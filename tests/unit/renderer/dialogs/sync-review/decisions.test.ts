// spec/screens-variants.md, "Sync review": "Accept all" sends every change with accept: true;
// "Accept selected" only the ticked ones. Each blocked path goes with its choice, and a path
// with no choice is sent as "keep-mine" (the default radio).
import { describe, expect, it } from 'vitest'
import {
  acceptAll,
  acceptSelected,
  changeKey,
  choiceKey,
} from '@/renderer/dialogs/sync-review/decisions'
import type { SyncChange, SyncPreview } from '@/shared/schemas/queries/sync'

function change(layerKey: string, blockedByOverride: string[] = []): SyncChange {
  return {
    layerKey,
    layerName: layerKey,
    kind: 'update',
    groups: ['style'],
    proposed: {},
    blockedByOverride,
  }
}

const VARIANTS: SyncPreview[] = [
  { variantId: 'V2', changes: [change('headline', ['style.color', 'copy']), change('logo')] },
  { variantId: 'V3', changes: [change('headline', ['style.color'])] },
]

describe('sync decisions', () => {
  it('accept all sends every change, each blocked path kept as mine with no choice', () => {
    expect(acceptAll(VARIANTS, {})).toEqual([
      {
        variantId: 'V2',
        layerKey: 'headline',
        accept: true,
        overrides: [
          { path: 'style.color', choice: 'keep-mine' },
          { path: 'copy', choice: 'keep-mine' },
        ],
      },
      { variantId: 'V2', layerKey: 'logo', accept: true, overrides: [] },
      {
        variantId: 'V3',
        layerKey: 'headline',
        accept: true,
        overrides: [{ path: 'style.color', choice: 'keep-mine' }],
      },
    ])
  })

  it('sends the override choices made, for that variant and layer only', () => {
    const choices = { [choiceKey('V2', 'headline', 'style.color')]: 'take-master' as const }
    const sent = acceptAll(VARIANTS, choices)
    expect(sent[0]?.overrides).toEqual([
      { path: 'style.color', choice: 'take-master' },
      { path: 'copy', choice: 'keep-mine' },
    ])
    expect(sent[2]?.overrides).toEqual([{ path: 'style.color', choice: 'keep-mine' }])
  })

  it('accept selected sends only the ticked changes, with their choices', () => {
    const ticked = new Set([changeKey('V3', 'headline'), changeKey('V2', 'logo')])
    const choices = { [choiceKey('V3', 'headline', 'style.color')]: 'take-master' as const }
    expect(acceptSelected(VARIANTS, ticked, choices)).toEqual([
      { variantId: 'V2', layerKey: 'logo', accept: true, overrides: [] },
      {
        variantId: 'V3',
        layerKey: 'headline',
        accept: true,
        overrides: [{ path: 'style.color', choice: 'take-master' }],
      },
    ])
  })

  it('accept selected with nothing ticked sends nothing', () => {
    expect(acceptSelected(VARIANTS, new Set(), {})).toEqual([])
  })

  it('keys tell apart IDs that would run together as plain text', () => {
    expect(changeKey('a', 'bc')).not.toBe(changeKey('ab', 'c'))
    expect(choiceKey('V', 'a', 'bc')).not.toBe(choiceKey('V', 'ab', 'c'))
  })
})
