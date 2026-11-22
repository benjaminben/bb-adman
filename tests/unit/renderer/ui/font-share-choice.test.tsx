// P9-12 (spec/phases/phase-09.md "Screens", "Font sharing consent is local"; A-229, A-260): the
// "I am allowed to share this font" tick. It is never ticked from the project file's flag; a
// tick writes this computer's consent through publish.setFontConsent, bound to the hash shown.
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FontShareChoice } from '@/renderer/ui/font-share-choice'
import type { PublishInspectComponent } from '@/shared/schemas/queries/publish'
import { SHA, font } from '../dialogs/publish-fixture'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'

const CONFIRM_LINE = 'This project file says the font may be shared. Confirm it on this computer.'
const TICK = 'I am allowed to share this font'

async function show(fonts: PublishInspectComponent[], fake = makeFakeApi()) {
  const onChanged = vi.fn()
  await renderApp(<FontShareChoice projectId="p1" fonts={fonts} onChanged={onChanged} />, fake)
  const group = (name: string) => screen.getByRole('group', { name })
  return { fake, onChanged, group }
}

const sent = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name !== 'app.getState')

describe('the font share tick [P9-12, A-229, A-260]', () => {
  it('starts a needs_confirming font unticked, with the confirm line', async () => {
    const { group } = await show([font({ share: 'needs_confirming' })])
    const harbor = group('Harbor Sans')
    expect(within(harbor).getByRole('checkbox', { name: TICK })).not.toBeChecked()
    expect(harbor).toHaveTextContent(CONFIRM_LINE)
    expect(await axeViolations()).toEqual([])
  })

  it('ticks only a confirmed font, and gives the confirm line only to needs_confirming', async () => {
    const { group } = await show([
      font({ share: 'confirmed' }),
      font({ assetId: '01JD0000000000000000000010', displayName: 'Lido', share: 'not_shared' }),
    ])
    expect(within(group('Harbor Sans')).getByRole('checkbox')).toBeChecked()
    expect(within(group('Lido')).getByRole('checkbox')).not.toBeChecked()
    expect(group('Harbor Sans')).not.toHaveTextContent(CONFIRM_LINE)
    expect(group('Lido')).not.toHaveTextContent(CONFIRM_LINE)
  })

  it('ticking sends setFontConsent with the hash shown, then asset.update, then reads again', async () => {
    const { fake, onChanged, group } = await show([font({ share: 'needs_confirming' })])
    fake.onCommand('publish.setFontConsent', () => {
      expect(onChanged).not.toHaveBeenCalled()
      return { ok: true, data: {} }
    })
    await userEvent.click(within(group('Harbor Sans')).getByRole('checkbox', { name: TICK }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    const assetId = '01JD0000000000000000000009'
    expect(sent(fake)).toEqual([
      {
        name: 'publish.setFontConsent',
        input: { projectId: 'p1', assetId, allowed: true, sha256: SHA },
      },
      { name: 'asset.update', input: { projectId: 'p1', assetId, fontPublishAllowed: true } },
    ])
  })

  it('unticking sends allowed false', async () => {
    const { fake, onChanged, group } = await show([font({ share: 'confirmed' })])
    await userEvent.click(within(group('Harbor Sans')).getByRole('checkbox', { name: TICK }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(sent(fake).map((c) => c.input)).toEqual([
      expect.objectContaining({ allowed: false }),
      expect.objectContaining({ fontPublishAllowed: false }),
    ])
  })

  it('shows a refusal as its sentence, sends nothing more and keeps the box unticked', async () => {
    const fake = makeFakeApi()
    const message = 'The font file cannot be found or is not a usable font.'
    fake.onCommand('publish.setFontConsent', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message },
    }))
    const { onChanged, group } = await show([font({ share: 'needs_confirming' })], fake)
    const box = within(group('Harbor Sans')).getByRole('checkbox', { name: TICK })
    await userEvent.click(box)
    expect(await within(group('Harbor Sans')).findByRole('alert')).toHaveTextContent(message)
    expect(sent(fake).map((c) => c.name)).toEqual(['publish.setFontConsent'])
    expect(box).not.toBeChecked()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('offers no tick for a font whose file has a problem', async () => {
    const { group } = await show([
      font({ problem: 'missing', sha256: null, share: 'needs_confirming' }),
    ])
    expect(within(group('Harbor Sans')).getByRole('checkbox', { name: TICK })).toBeDisabled()
  })
})
