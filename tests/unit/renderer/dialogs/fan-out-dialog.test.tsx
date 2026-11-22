// spec/screens-variants.md, "Fan-out" [P5-16]: the dialog's words and labels, the fit groups,
// the provider select and paid line with a fill, the sent input, refusals, and the fills
// started after success, each attached with a finish that sends generation.applyFill.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FanOutButton } from '@/renderer/dialogs/fan-out'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Result } from '@/shared/schemas/result'
import { baseState, makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { LOCAL, P, campaignGet, sent, variant } from '../screens/campaign/campaign-fixture'
import { REFUSED, heldReply } from '../screens/campaign/held-reply'
import { jobRow } from '../stores/job-fixture'

const MASTER = variant('V1', { title: 'Master post', isMaster: true, sizeLabel: '1x1' })

function data(): CampaignGet {
  const base = campaignGet([MASTER])
  const sizes = [
    { label: '1x1', width: 1080, height: 1080 },
    { label: '9x16', width: 1080, height: 1920 },
    { label: '1080x1080', width: 1080, height: 1080 },
  ]
  return {
    ...base,
    campaign: { ...base.campaign, sizes, languages: ['en', 'de'] },
    directions: [{ id: 'D1', campaignId: 'C1', name: 'Beach day', masterVariantId: 'V1', sort: 0 }],
  }
}

const background = (source: LayerRow['source']) => ({ id: 'L1', type: 'background', source })

// The master's picture as variant.get returns it, with its paths.
const PATH = '/Users/me/Pictures/private/beach.png'
const ASSET = { id: 'A1', displayName: 'beach.png', absPath: PATH, relPath: 'assets/beach.png' }

function api(opts: { picture?: boolean } = {}) {
  const base = baseState()
  const fake = makeFakeApi(baseState({ providers: [...base.providers, LOCAL] }))
  const source = opts.picture === false ? null : { assetId: 'A1' }
  fake.onQuery('variant.get', () => ({
    ok: true,
    data: { variant: MASTER, campaignId: 'C1', layers: [background(source)], assets: [ASSET] },
  }))
  return fake
}

async function open(fake = api()) {
  const view = await renderApp(
    <main>
      <h1>Summer Splash</h1>
      <FanOutButton projectId={P} campaign={data()} direction={data().directions[0]!} />
    </main>,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Fan out…' }))
  const dialog = await screen.findByRole('dialog', { name: 'Fan out Beach day' })
  return { ...view, dialog }
}

const tick = (name: string) => userEvent.click(screen.getByRole('checkbox', { name }))
const make = () => screen.getByRole('button', { name: 'Make variants' })
const fillOf = (size: string) =>
  within(screen.getByRole('group', { name: `Background for ${size}` })).getByRole('radio', {
    name: 'Generate fill: extend the picture with AI',
  })

describe('Fan-out dialog [P5-16]', () => {
  it("draws the sizes and languages with the master's ticked and disabled", async () => {
    const { dialog } = await open()
    const sizes = within(dialog).getByRole('group', { name: 'Sizes' })
    expect(within(sizes).getAllByRole('checkbox')).toHaveLength(3)
    const square = within(sizes).getByRole('checkbox', { name: '1x1 (1080×1080)' })
    expect(square).toBeChecked()
    expect(square).toBeDisabled()
    expect(within(sizes).getByRole('checkbox', { name: '9x16 (1080×1920)' })).not.toBeChecked()
    const languages = within(dialog).getByRole('group', { name: 'Languages' })
    expect(within(languages).getByRole('checkbox', { name: 'en' })).toBeDisabled()
    expect(within(languages).getByRole('checkbox', { name: 'de' })).toBeEnabled()
    expect(within(dialog).getByText('This makes 0 variant(s).')).toBeInTheDocument()
    expect(within(dialog).getByText('Nothing new to make.')).toBeInTheDocument()
    expect(make()).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(await axeViolations()).toEqual([])
  })

  it('draws a fit group for each ticked size of another pixel size, scale first', async () => {
    const { dialog } = await open()
    await tick('1080x1080 (1080×1080)')
    expect(within(dialog).queryByText(/Background for/)).toBeNull()
    await tick('9x16 (1080×1920)')
    const group = within(dialog).getByRole('group', { name: 'Background for 9x16 (1080×1920)' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.closest('div')?.textContent)).toEqual([
      'Scale: show the whole picture, black at the edges',
      'Crop: fill the size and hide the edges',
      'Generate fill: extend the picture with AI',
    ])
    expect(radios[0]).toBeChecked()
    expect(within(dialog).getByText('This makes 2 variant(s).')).toBeInTheDocument()
    await tick('9x16 (1080×1920)')
    expect(within(dialog).queryByText(/Background for/)).toBeNull()
  })

  it('shows the provider select and paid line only with a fill, naming the chosen provider', async () => {
    const { dialog } = await open()
    await tick('9x16 (1080×1920)')
    expect(within(dialog).queryByRole('combobox')).toBeNull()
    expect(within(dialog).queryByText(/generation\(s\)/)).toBeNull()
    await userEvent.click(fillOf('9x16 (1080×1920)'))
    const select = within(dialog).getByRole('combobox', { name: 'Provider' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Google Gemini', 'Stand-in'])
    expect(select).toHaveValue('gemini')
    expect(
      within(dialog).getByText('This will use 1 generation(s) with Google Gemini.'),
    ).toBeInTheDocument()
    await userEvent.selectOptions(select, 'fake')
    expect(within(dialog).getByText('This will use 1 generation(s) with Stand-in.')).toBeVisible()
    expect(await axeViolations()).toEqual([])
  })

  it('draws no fit groups without a background picture and sends scale', async () => {
    const { dialog, fake } = await open(api({ picture: false }))
    fake.onCommand('variant.fanOut', () => ({ ok: true, data: { variantIds: ['V2'], fill: [] } }))
    await tick('9x16 (1080×1920)')
    expect(within(dialog).queryByText(/Background for/)).toBeNull()
    await userEvent.click(make())
    await waitFor(() => expect(sent(fake, 'variant.fanOut')).toHaveLength(1))
    expect(sent(fake, 'variant.fanOut')[0]?.input).toMatchObject({ fits: { '9x16': 'scale' } })
  })

  it('sends the ticked lists, images only and the chosen fits; nothing paid is sent', async () => {
    const { fake } = await open()
    fake.onCommand('variant.fanOut', () => ({ ok: true, data: { variantIds: ['V2'], fill: [] } }))
    await tick('9x16 (1080×1920)')
    await tick('de')
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Background for 9x16 (1080×1920)' })).getByRole(
        'radio',
        { name: 'Crop: fill the size and hide the edges' },
      ),
    )
    expect(fake.commands).toEqual([])
    await userEvent.click(make())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(fake.commands).toEqual([
      {
        name: 'variant.fanOut',
        input: {
          projectId: P,
          directionId: 'D1',
          sizes: ['1x1', '9x16'],
          languages: ['en', 'de'],
          formats: ['image'],
          fits: { '9x16': 'crop' },
        },
      },
    ])
  })

  it('keeps the dialog open and locked while waiting, then shows a refusal inside it', async () => {
    const { fake, store } = await open()
    const held = heldReply()
    fake.onCommand('variant.fanOut', held.answer)
    await tick('de')
    await userEvent.click(make())
    expect(make()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    held.release(REFUSED)
    expect(await screen.findByRole('alert')).toHaveTextContent('The run was refused.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(store.getState().error).toBe('The run was refused.')
    expect(make()).toBeEnabled()
  })

  it('after success starts one fill per entry with the chosen provider, attached, applied on success', async () => {
    const { fake } = await open()
    fake.onCommand('variant.fanOut', () => ({
      ok: true,
      data: { variantIds: ['V2'], fill: [{ sizeLabel: '9x16', variantId: 'V2' }] },
    }))
    fake.onCommand('generation.runFill', () => ({ ok: true, data: { jobId: 'J7' } }))
    await tick('9x16 (1080×1920)')
    await userEvent.click(fillOf('9x16 (1080×1920)'))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Provider' }), 'fake')
    expect(sent(fake, 'generation.runFill')).toEqual([])
    expect(screen.getByText('This will use 1 generation(s) with Stand-in.')).toBeVisible()
    await userEvent.click(make())
    await waitFor(() => expect(sent(fake, 'generation.runFill')).toHaveLength(1))
    expect(sent(fake, 'variant.fanOut')[0]?.input).toMatchObject({ fits: { '9x16': 'fill' } })
    expect(sent(fake, 'generation.runFill')[0]?.input).toEqual({
      projectId: P,
      variantId: 'V2',
      provider: 'fake',
    })
    const attached = attachedStoreFor(fake.api)
    await waitFor(() => expect(attached.getState().jobs.map((j) => j.jobId)).toEqual(['J7']))
    expect(attached.getState().jobs[0]?.owner).toEqual({ projectId: P, variantId: 'V2' })
    expect(sent(fake, 'generation.applyFill')).toEqual([])
    const row = { kind: 'generative_fill' as const, variantId: 'V2', provider: 'fake' }
    fake.emit('job.updated', jobRow('J7', { ...row, status: 'succeeded' }))
    await waitFor(() =>
      expect(sent(fake, 'generation.applyFill').map((c) => c.input)).toEqual([
        { projectId: P, jobId: 'J7' },
      ]),
    )
  })

  it('a refused fill shows in the banner, registers nothing and leaves the variants', async () => {
    const { fake, store } = await open()
    fake.onCommand('variant.fanOut', () => ({
      ok: true,
      data: { variantIds: ['V2'], fill: [{ sizeLabel: '9x16', variantId: 'V2' }] },
    }))
    const message = 'The background already covers the whole variant.'
    const refused: Result<unknown> = { ok: false, error: { code: 'RULE_VIOLATION', message } }
    fake.onCommand('generation.runFill', () => refused)
    await tick('9x16 (1080×1920)')
    await userEvent.click(fillOf('9x16 (1080×1920)'))
    await userEvent.click(make())
    await waitFor(() => expect(store.getState().error).toBe(message))
    expect(sent(fake, 'generation.runFill')[0]?.input).toMatchObject({ provider: 'gemini' })
    expect(attachedStoreFor(fake.api).getState().jobs).toEqual([])
    expect(fake.commands.map((c) => c.name)).toEqual(['variant.fanOut', 'generation.runFill'])
  })

  it('draws no path and sends none, from open to the started fill', async () => {
    const { dialog, fake } = await open()
    fake.onCommand('variant.fanOut', () => ({
      ok: true,
      data: { variantIds: ['V2'], fill: [{ sizeLabel: '9x16', variantId: 'V2' }] },
    }))
    fake.onCommand('generation.runFill', () => ({ ok: true, data: { jobId: 'J7' } }))
    await tick('9x16 (1080×1920)')
    await userEvent.click(fillOf('9x16 (1080×1920)'))
    expect(dialog.textContent).not.toMatch(/[\\/]|beach|Users/)
    await userEvent.click(make())
    await waitFor(() => expect(sent(fake, 'generation.runFill')).toHaveLength(1))
    expect(document.body.textContent).not.toMatch(/beach|Users|assets\//)
    expect(JSON.stringify(fake.commands)).not.toMatch(/beach|Users|assets\//)
  })
})
