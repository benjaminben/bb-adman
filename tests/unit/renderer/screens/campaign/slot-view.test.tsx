// spec/screens-campaign.md "The slot view" (S2-15) [FR-042]: the master's slots in template
// order, filled or empty, with the pictures that could fill an empty picture slot.
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlotView } from '@/renderer/screens/campaign/slot-view'
import type { TemplateSlots } from '@/shared/schemas/queries/campaign'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { heldReply } from './held-reply'
import { ref } from './reference-fixture'

const P = '01JD00000000000000000000P1'
const view = <SlotView projectId={P} campaignId="C1" />

type Slot = TemplateSlots[number]
const slot = (id: string, over: Partial<Slot> = {}): Slot => ({
  slot: { id, type: 'image' },
  state: 'empty',
  candidates: [],
  ...over,
})

function slotApi(slots: TemplateSlots, assets = [ref('A1')]) {
  const fake = makeFakeApi()
  fake.onQuery('template.slots', () => ({ ok: true, data: slots }))
  fake.onQuery('asset.list', () => ({ ok: true, data: assets }))
  return fake
}

async function region() {
  return within(await screen.findByRole('region', { name: 'Slots' }))
}

async function rows() {
  const r = await region()
  const list = await r.findByRole('list', { name: 'Slots of the master' })
  return within(list)
    .getAllByRole('listitem')
    .filter((li) => li.parentElement === list)
}

const count = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.queries.filter((q) => q.name === name).length

describe('SlotView [FR-042]', () => {
  it('reads template.slots for the campaign and asset.list for images', async () => {
    const fake = slotApi([slot('logo', { candidates: ['A1'] })])
    await renderApp(view, fake)
    await rows()
    const sent = (name: string) => fake.queries.filter((q) => q.name === name).map((q) => q.input)
    expect(sent('template.slots')).toEqual([{ projectId: P, campaignId: 'C1' }])
    expect(sent('asset.list')).toEqual([{ projectId: P, kind: 'image' }])
  })

  it('does not read asset.list when no empty picture slot has candidates', async () => {
    const fake = slotApi([
      slot('subject-image', { state: 'filled', candidates: ['A1'] }),
      slot('headline', { slot: { id: 'headline', type: 'copy' }, candidates: ['A1'] }),
      slot('logo'),
    ])
    await renderApp(view, fake)
    await rows()
    expect(count(fake, 'asset.list')).toBe(0)
  })

  it('shows one row per slot in template order, with its name and state', async () => {
    const table: Array<[Slot, string]> = [
      [slot('background', { state: 'filled' }), 'Background Filled'],
      [slot('subject-image'), 'Subject picture Empty'],
      [slot('logo'), 'Logo Empty'],
      [slot('headline', { slot: { id: 'headline', type: 'copy' } }), 'Headline Empty'],
      [slot('call-to-action', { state: 'filled' }), 'Call to action Filled'],
      [slot('<b>badge</b>'), '<b>badge</b> Empty'],
    ]
    const { container } = await renderApp(view, slotApi(table.map(([s]) => s)))
    const texts = (await rows()).map((li) => li.textContent?.replace(/\s+/g, ' ').trim())
    expect(texts).toEqual(table.map(([, text]) => text))
    expect(container.querySelector('b')).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('lists the candidates of an empty picture slot with pictures from assetUrl', async () => {
    const assets = [
      ref('A1', { displayName: 'Can on grass.png' }),
      ref('A2', { displayName: '<b>Can</b>.png' }),
      ref('A3', { displayName: 'Gone.png', missing: true }),
    ]
    const slots = [slot('subject-image', { candidates: ['A1', 'A9', 'A2', 'A3'] })]
    const { container } = await renderApp(view, slotApi(slots, assets))
    const [row] = await rows()
    const r = within(row!)
    expect(r.getByText('Pictures that could go here:')).toBeInTheDocument()
    const items = r.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual(['Can on grass.png', '<b>Can</b>.png', 'file not foundGone.png'])
    const imgs = r
      .getAllByRole('img')
      .map((img) => [img.getAttribute('src'), img.getAttribute('alt')])
    expect(imgs).toEqual([
      [`adman-asset://${P}/A1`, 'Can on grass.png'],
      [`adman-asset://${P}/A2`, '<b>Can</b>.png'],
    ])
    expect(container.querySelector('b')).toBeNull()
    expect(container.innerHTML).not.toContain('/Users/me/Pictures')
    expect(await axeViolations()).toEqual([])
  })

  it('shows no candidate line for a filled slot, a copy slot, or candidates not listed', async () => {
    const slots = [
      slot('subject-image', { state: 'filled', candidates: ['A1'] }),
      slot('headline', { slot: { id: 'headline', type: 'copy' }, candidates: ['A1'] }),
      slot('logo', { candidates: ['A9'] }),
      slot('background'),
    ]
    await renderApp(view, slotApi(slots))
    await rows()
    expect(screen.queryByText('Pictures that could go here:')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('reads again on project.changed for this project only', async () => {
    const fake = slotApi([slot('logo', { candidates: ['A1'] })])
    await renderApp(view, fake)
    await rows()
    const change = { changed: {}, removed: {}, actor: 'user' as const }
    fake.emit('project.changed', { projectId: 'other', ...change })
    fake.emit('project.changed', { projectId: P, ...change })
    await waitFor(() => expect(count(fake, 'template.slots')).toBe(2))
    expect(count(fake, 'asset.list')).toBe(2)
    fake.onQuery('template.slots', () => ({ ok: true, data: [slot('logo', { state: 'filled' })] }))
    fake.emit('project.changed', { projectId: P, ...change })
    expect(await screen.findByText('Filled')).toBeInTheDocument()
  })

  it.each<[string, Result<unknown> | null, string]>([
    ['loading', null, 'Reading the slots…'],
    [
      'refused',
      { ok: false, error: { code: 'NOT_FOUND', message: 'That campaign was not found.' } },
      'That campaign was not found.',
    ],
    ['no slots', { ok: true, data: [] }, "This campaign's template has no slots."],
  ])('shows the %s sentence', async (_name, reply, sentence) => {
    const fake = slotApi([])
    const held = heldReply()
    fake.onQuery('template.slots', held.answer)
    await renderApp(view, fake)
    if (reply !== null) held.release(reply)
    const r = await region()
    expect(r.getByRole('heading', { name: 'Slots of the master' })).toBeInTheDocument()
    expect(await r.findByText(sentence)).toBeInTheDocument()
    expect(r.queryByRole('list')).toBeNull()
    expect(await axeViolations()).toEqual([])
  })
})
