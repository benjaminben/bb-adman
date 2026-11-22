// P4-12 (spec/screens-ai.md, "The run confirmation dialog"): one dialog confirms every Phase 4
// run. The caller sends the command; the dialog only chooses, counts and waits for the reply.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RunDialog, type RunDialogProps } from '@/renderer/dialogs/run-dialog'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { Result } from '@/shared/schemas/result'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { costLine } from '../cost-line'

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
const FAKE: ProviderInfo = {
  ...COMFY,
  id: 'fake',
  label: 'Fake provider',
  jobs: ['image', 'layout', 'text', 'video', 'cutout'],
}
const ADDRESS = 'http://127.0.0.1:8188'

type Flow = { job: string; status: string; offered: boolean; label: string }
const IMAGE_FLOW = { job: 'image', status: 'proven', offered: true, label: 'MOSS text to image' }
const CUTOUT_FLOW = { job: 'cutout', status: 'trial', offered: true, label: 'BiRefNet cut-out' }

function setup(
  options: { flows?: Flow[]; providers?: ProviderInfo[]; defaultImage?: string } = {},
) {
  const state = baseState()
  const fake = makeFakeApi(
    baseState({
      providers: options.providers ?? [...state.providers, COMFY, FAKE],
      settings: {
        ...state.settings,
        defaultProviders: {
          ...state.settings.defaultProviders,
          image: options.defaultImage ?? 'gemini',
        },
      },
    }),
  )
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: { address: ADDRESS, workflows: options.flows ?? [IMAGE_FLOW], leavesOnServer: [] },
  }))
  fake.onQuery('campaign.paidCount', () => ({
    ok: true,
    data: { pictures: 7, videos: 1, text: 0 },
  }))
  return fake
}

const ok: Result<unknown> = { ok: true, data: null }

async function open(over: Partial<RunDialogProps> = {}, fake = setup()) {
  const onConfirm = vi.fn(async () => ok)
  const onCancel = vi.fn()
  const props: RunDialogProps = {
    open: true,
    projectId: 'P1',
    job: 'image',
    title: 'Make pictures',
    confirmLabel: 'Generate',
    onConfirm,
    onCancel,
    ...over,
  }
  const view = await renderApp(<RunDialog {...props} />, fake)
  await screen.findByRole('dialog', { name: props.title })
  // comfy.getInfo answers after the first draw.
  await act(async () => {})
  return { ...view, onConfirm: props.onConfirm, onCancel }
}

const radios = () =>
  within(screen.getByRole('group', { name: 'Provider' }))
    .getAllByRole('radio')
    .map(
      (r) =>
        `${(r as HTMLInputElement).labels?.[0]?.textContent}${r.hasAttribute('disabled') ? ' [off]' : ''}`,
    )
const confirm = (name = 'Generate') => screen.getByRole('button', { name })

describe('run dialog [P4-12]', () => {
  it.each<[RunDialogProps['job'], string[]]>([
    ['image', ['Google Gemini', 'Adobe Firefly [off]', 'ComfyUI', 'Fake provider']],
    ['cutout', ['ComfyUI [off]', 'Fake provider']],
    ['layout', ['Google Gemini', 'Fake provider']],
    ['text', ['Google Gemini', 'Fake provider']],
  ])('lists the providers whose jobs hold %s, ComfyUI first for cut-outs', async (job, list) => {
    await open({ job })
    expect(radios()).toEqual(list)
  })

  it('disables ComfyUI with its words when no workflow is offered for the run', async () => {
    await open({ referenceCount: 2 })
    expect(screen.getByRole('radio', { name: 'ComfyUI' })).toBeDisabled()
  })

  it('shows the trial mark beside ComfyUI for an offered trial workflow', async () => {
    await open({ job: 'cutout' }, setup({ flows: [CUTOUT_FLOW] }))
    const comfy = screen.getByRole('radio', { name: 'ComfyUI' })
    expect(comfy).toBeEnabled()
    expect(comfy).toHaveAccessibleDescription('(trial)')
  })

  it.each<[string, Partial<RunDialogProps>, Parameters<typeof setup>[0], string]>([
    ['the default provider for the job', {}, {}, 'Google Gemini'],
    [
      'the first enabled one when the default is off',
      {},
      { defaultImage: 'firefly' },
      'Google Gemini',
    ],
    ['ComfyUI for a cut-out', { job: 'cutout' }, { flows: [CUTOUT_FLOW] }, 'ComfyUI'],
    [
      'the fake provider for a cut-out with no ComfyUI workflow',
      { job: 'cutout' },
      {},
      'Fake provider',
    ],
  ])('starts at %s', async (_name, over, options, name) => {
    await open(over, setup(options))
    expect(screen.getByRole('radio', { name })).toBeChecked()
  })

  it('draws the summary line for the chosen provider, ComfyUI with its address and workflow', async () => {
    await open({ count: { label: 'Pictures', value: 4, min: 1, max: 8 }, referenceCount: 0 })
    expect(screen.getByText(costLine('Paid: 4 pictures → Google Gemini'))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'ComfyUI' }))
    expect(
      screen.getByText(
        `This runs on your ComfyUI server at ${ADDRESS} with the workflow MOSS text to image. Nothing is charged.`,
      ),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Fake provider' }))
    expect(screen.getByText('This uses the fake provider. Nothing is charged.')).toBeInTheDocument()
  })

  it('names the reference pictures a paid run sends', async () => {
    await open({ count: { label: 'Pictures', value: 2, min: 1, max: 8 }, referenceCount: 3 })
    expect(
      screen.getByText(costLine('Paid: 2 pictures + 3 references → Google Gemini')),
    ).toBeInTheDocument()
  })

  it.each([
    ['0', false],
    ['9', false],
    ['2.5', false],
    ['', false],
    ['8', true],
    ['3', true],
  ])('keeps the count within its bounds: %s', async (typed, allowed) => {
    const { onConfirm } = await open({ count: { label: 'Pictures', value: 4, min: 1, max: 8 } })
    const field = screen.getByRole('spinbutton', { name: 'Pictures' })
    await userEvent.clear(field)
    if (typed !== '') await userEvent.type(field, typed)
    if (!allowed) return expect(confirm()).toBeDisabled()
    await userEvent.click(confirm())
    expect(onConfirm).toHaveBeenCalledWith('gemini', Number(typed))
  })

  it('sends the chosen provider and no count when the caller gave none', async () => {
    const { onConfirm } = await open({
      job: 'layout',
      title: 'Place text with AI',
      confirmLabel: 'Place text',
    })
    expect(screen.getByText(costLine('Paid: 1 request → Google Gemini'))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Fake provider' }))
    await userEvent.click(confirm('Place text'))
    expect(onConfirm).toHaveBeenCalledWith('fake', null)
  })

  it('fixes the provider and count in retry mode', async () => {
    const { onConfirm } = await open({
      title: 'Retry the run',
      confirmLabel: 'Retry',
      retry: { provider: 'gemini' },
      count: { label: 'Pictures', value: 2, min: 1, max: 8 },
    })
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.getByText('Provider: Google Gemini')).toBeInTheDocument()
    expect(screen.getByText('Pictures: 2')).toBeInTheDocument()
    expect(screen.getByText(costLine('Paid: 2 pictures → Google Gemini'))).toBeInTheDocument()
    await userEvent.click(confirm('Retry'))
    expect(onConfirm).toHaveBeenCalledWith('gemini', 2)
  })

  it('keeps Confirm disabled from the click until the caller resolves, and shows a refusal', async () => {
    let answer: (r: Result<unknown>) => void = () => {}
    const onConfirm = vi.fn(() => new Promise<Result<unknown>>((resolve) => (answer = resolve)))
    await open({ onConfirm })
    await userEvent.click(confirm())
    expect(confirm()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.click(confirm())
    expect(onConfirm).toHaveBeenCalledOnce()
    await act(async () =>
      answer({ ok: false, error: { code: 'INVALID_INPUT', message: 'That provider is busy.' } }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('That provider is busy.')
    expect(confirm()).toBeEnabled()
  })

  it('shows no refusal for a licence question that was cancelled: its own dialog asked', async () => {
    const error = {
      code: 'INVALID_INPUT' as const,
      message: 'Confirm that you have a licence first.',
      details: { reason: 'licence_not_confirmed', workflow: 'h3' },
    }
    await open({ onConfirm: vi.fn(async () => ({ ok: false as const, error })) })
    await userEvent.click(confirm())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(confirm()).toBeEnabled()
  })

  it('says no provider can do this when none is enabled, with Confirm disabled', async () => {
    const state = baseState()
    await open({ job: 'cutout' }, setup({ providers: [...state.providers, COMFY] }))
    expect(screen.getByRole('alert')).toHaveTextContent('No provider can do this yet.')
    expect(confirm()).toBeDisabled()
  })

  // The starting choice depends on comfy.getInfo, so nothing can be chosen or sent before it
  // answers: a choice made early would be swapped for ComfyUI under the user.
  it('lets nothing be chosen or confirmed until comfy.getInfo has answered', async () => {
    const fake = setup()
    let answer: (reply: Result<unknown>) => void = () => {}
    fake.onQuery('comfy.getInfo', () => new Promise<Result<unknown>>((r) => (answer = r)))
    await open({ job: 'cutout', confirmLabel: 'Cut out' }, fake)
    expect(screen.getByRole('group', { name: 'Provider' })).toBeDisabled()
    expect(confirm('Cut out')).toBeDisabled()
    expect(screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toEqual([])
    expect(screen.queryByText('No provider can do this yet.')).toBeNull()
    const data = { address: ADDRESS, workflows: [CUTOUT_FLOW], leavesOnServer: [] }
    await act(async () => answer({ ok: true, data }))
    expect(screen.getByRole('radio', { name: 'ComfyUI' })).toBeChecked()
    expect(screen.getByRole('group', { name: 'Provider' })).toBeEnabled()
    expect(confirm('Cut out')).toBeEnabled()
  })

  it('still offers the other providers when comfy.getInfo is refused', async () => {
    const fake = setup()
    const error = { code: 'INTERNAL' as const, message: 'No.' }
    fake.onQuery('comfy.getInfo', () => ({ ok: false, error }))
    await open({ job: 'cutout', confirmLabel: 'Cut out' }, fake)
    expect(screen.getByRole('radio', { name: 'Fake provider' })).toBeChecked()
    expect(confirm('Cut out')).toBeEnabled()
  })

  it('cancels', async () => {
    const { onCancel, onConfirm } = await open()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("shows the campaign's paid count when given a campaign", async () => {
    await open({ campaignId: 'C1' })
    expect(
      await screen.findByText('Paid generations for this campaign so far: 7 pictures, 1 videos.'),
    ).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await open(
      {
        campaignId: 'C1',
        count: { label: 'Pictures', value: 4, min: 1, max: 8 },
      },
      setup({ flows: [{ ...IMAGE_FLOW, status: 'trial' }] }),
    )
    await screen.findByText(/Paid generations/)
    expect(await axeViolations()).toEqual([])
  })
})
