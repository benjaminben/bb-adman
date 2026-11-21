// spec/phases/phase-06.md, design addition 8, "Editor" (P6-14): under Copy, a translated text
// layer shows "Translation: {Missing | Proposed | Approved}, {source}", and "Approve" on a
// proposed one, which sends translation.approve with the copy counter the window read.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TranslationStatus } from '@/renderer/editor/translation-status'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { HEADLINE } from './editor-fixture'

const translated = (
  status: LayerRow['translationStatus'],
  source: LayerRow['translationSource'],
): LayerRow => ({
  ...HEADLINE,
  revs: { ...HEADLINE.revs, copy: 7 },
  translationStatus: status,
  translationSource: source,
})

async function setup(layer: LayerRow, fake = makeFakeApi()) {
  await renderApp(
    <main>
      <TranslationStatus projectId="P1" layer={layer} />
    </main>,
    fake,
  )
  return fake
}

describe('TranslationStatus [P6-14, design addition 8 "Editor"]', () => {
  it.each([
    ['missing', null, 'Translation: Missing'],
    ['proposed', 'ai', 'Translation: Proposed, from AI'],
    ['proposed', 'agent', 'Translation: Proposed, from an agent'],
    ['proposed', 'user', 'Translation: Proposed, from you'],
    ['approved', 'brief', 'Translation: Approved, from the brief'],
    ['approved', 'user', 'Translation: Approved, from you'],
  ] as const)('%s from %s reads "%s"', async (status, source, words) => {
    await setup(translated(status, source))
    expect(screen.getByText(words)).toBeInTheDocument()
  })

  it.each([
    ['missing', false],
    ['proposed', true],
    ['approved', false],
  ] as const)('a %s translation shows Approve: %s', async (status, shown) => {
    await setup(translated(status, 'ai'))
    const button = screen.queryByRole('button', { name: 'Approve' })
    expect(button !== null).toBe(shown)
  })

  it('Approve sends translation.approve with the layer and its copy counter', async () => {
    const fake = await setup(translated('proposed', 'ai'))
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(fake.commands).toEqual([
      {
        name: 'translation.approve',
        input: { projectId: 'P1', layers: [{ layerId: 'L1', copyRev: 7 }] },
      },
    ])
  })

  it('a refusal shows its sentence under the status', async () => {
    const fake = makeFakeApi()
    const message = 'A text changed after you read it. Read it again, then approve.'
    fake.onCommand('translation.approve', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'translation_changed' } },
    }))
    await setup(translated('proposed', 'ai'), fake)
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await setup(translated('proposed', 'ai'))
    expect(await axeViolations()).toEqual([])
  })
})
