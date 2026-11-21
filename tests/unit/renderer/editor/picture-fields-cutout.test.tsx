// P4-19, spec/screens-ai.md "Cut-out" [REQ: FR-307]: "Cut out the subject…" under "Choose
// picture…" for a layer with a picture, shown when some provider can cut out. It opens the run
// dialog (job cutout, no count); Confirm sends generation.cutOut; one line follows the job.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PictureFields } from '@/renderer/editor/picture-fields'
import { plainMessage } from '@/shared/providers/messages'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { baseState, makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { sent } from '../screens/campaign/campaign-fixture'
import { jobRow } from '../stores/job-fixture'
import { LOGO, P } from './editor-fixture'

const LOCAL = { local: true, cancel: 'stops', serverText: false } as const
const COMFY: ProviderInfo = {
  id: 'comfyui',
  label: 'ComfyUI',
  jobs: ['image', 'video', 'cutout'],
  available: true,
  secrets: [],
  defaultModels: {},
  ...LOCAL,
}
const FAKE: ProviderInfo = { ...COMFY, id: 'fake', label: 'Fake provider' }
const CUTOUT_FLOW = { job: 'cutout', status: 'proven', offered: true, label: 'BiRefNet cut-out' }

const WITH_PICTURE: LayerRow = { ...LOGO, source: { assetId: 'A1' } }
const CUT_OUT = 'Cut out the subject…'

type Options = { providers?: readonly ProviderInfo[]; flows?: readonly object[]; layer?: LayerRow }

async function setup(options: Options = {}) {
  const state = baseState()
  const fake = makeFakeApi(
    baseState({ providers: [...state.providers, ...(options.providers ?? [FAKE])] }),
  )
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: { address: null, workflows: options.flows ?? [], leavesOnServer: [] },
  }))
  fake.onCommand('generation.cutOut', () => ({ ok: true, data: { jobId: 'J1' } }))
  await renderApp(
    <main>
      <PictureFields
        projectId={P}
        layer={options.layer ?? WITH_PICTURE}
        asset={null}
        canvas={null}
        onUpdate={vi.fn(async () => null)}
      />
    </main>,
    fake,
  )
  // comfy.getInfo answers after the first draw.
  await act(async () => {})
  return fake
}

async function cutOut() {
  await userEvent.click(screen.getByRole('button', { name: CUT_OUT }))
  const dialog = await screen.findByRole('dialog', { name: 'Cut out the subject' })
  await act(async () => {})
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cut out' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

describe('Cut-out button [spec/screens-ai.md "Cut-out"; FR-307]', () => {
  it.each([
    ['the fake provider, a picture', { providers: [FAKE] }, true],
    ['ComfyUI with an offered cutout workflow', { providers: [COMFY], flows: [CUTOUT_FLOW] }, true],
    ['ComfyUI with no cutout workflow', { providers: [COMFY] }, false],
    [
      'ComfyUI with a cutout workflow not offered',
      {
        providers: [COMFY],
        flows: [{ ...CUTOUT_FLOW, offered: false }],
      },
      false,
    ],
    ['no provider that cuts out', { providers: [] }, false],
    ['a layer with no picture', { providers: [FAKE], layer: LOGO }, false],
  ] as const)('is shown only when it can run: %s', async (_name, options, shown) => {
    await setup(options)
    const button = screen.queryByRole('button', { name: CUT_OUT })
    if (shown) expect(button).toBeVisible()
    else expect(button).toBeNull()
  })

  it('is disabled for a locked layer', async () => {
    await setup({ layer: { ...WITH_PICTURE, locked: true } })
    expect(screen.getByRole('button', { name: CUT_OUT })).toBeDisabled()
  })

  it('opens the run dialog with ComfyUI listed first and no count', async () => {
    await setup({ providers: [FAKE, COMFY], flows: [CUTOUT_FLOW] })
    await userEvent.click(screen.getByRole('button', { name: CUT_OUT }))
    const dialog = await screen.findByRole('dialog', { name: 'Cut out the subject' })
    await act(async () => {})
    const radios = within(dialog).getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['comfyui', 'fake'])
    expect(radios[0]).toBeChecked()
    expect(within(dialog).queryByRole('spinbutton')).toBeNull()
  })

  it('sends nothing until Confirm, then one generation.cutOut for the layer', async () => {
    const fake = await setup()
    await userEvent.click(screen.getByRole('button', { name: CUT_OUT }))
    await screen.findByRole('dialog', { name: 'Cut out the subject' })
    expect(sent(fake, 'generation.cutOut')).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(sent(fake, 'generation.cutOut')).toEqual([])
    await cutOut()
    expect(sent(fake, 'generation.cutOut').map((c) => c.input)).toEqual([
      { projectId: P, variantId: 'V1', layerId: WITH_PICTURE.id, provider: 'fake' },
    ])
  })

  it('keeps the dialog open with the refusal and shows no line', async () => {
    const fake = await setup()
    fake.onCommand('generation.cutOut', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Choose a picture for this layer first.' },
    }))
    await userEvent.click(screen.getByRole('button', { name: CUT_OUT }))
    const dialog = await screen.findByRole('dialog', { name: 'Cut out the subject' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cut out' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Choose a picture for this layer first.',
    )
    expect(screen.queryByText('Cutting out…')).toBeNull()
  })

  it.each([
    ['succeeded', {}, 'Done. The cut-out is under Earlier options.'],
    ['failed', { errorKind: 'quota' as const }, plainMessage('quota', 'Fake provider')],
    ['cancelled', {}, 'Cancelled.'],
  ] as const)('the line follows the started job until it has %s', async (status, over, line) => {
    const fake = await setup()
    await cutOut()
    expect(await screen.findByText('Cutting out…')).toBeVisible()
    const row = { kind: 'cutout' as const, provider: 'fake', layerId: WITH_PICTURE.id }
    act(() => fake.emit('job.updated', jobRow('J2', { ...row, status: 'succeeded' })))
    act(() => fake.emit('job.updated', jobRow('J1', { ...row, status: 'running' })))
    expect(screen.getByText('Cutting out…')).toBeVisible()
    act(() => fake.emit('job.updated', jobRow('J1', { ...row, status, ...over })))
    expect(await screen.findByText(line)).toBeVisible()
  })

  it('has no axe violations with the line shown', async () => {
    await setup()
    await cutOut()
    await screen.findByText('Cutting out…')
    expect(await axeViolations()).toEqual([])
  })
})
