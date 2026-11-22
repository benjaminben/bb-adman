// DLG-4a (design-wave-screens-b.md; choice C-15): in the run dialog the action button is the
// one click that pays. The cost line (a MoneyLine for a paid provider) is the body's last thing
// above the foot and in the dialog's accessible description; nothing is sent before the click;
// one click sends one run, with the provider, count, seconds and pictures the line names.
// The caller here sends a command from onConfirm, as the real callers do, so the fake api's
// command list shows what left. No provider is called.
import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RunDialog, type RunDialogProps } from '@/renderer/dialogs/run-dialog'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { Result } from '@/shared/schemas/result'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { costLine, spoken } from '../cost-line'

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
const FAL: ProviderInfo = { ...COMFY, id: 'fal-seedance', label: 'fal.ai Seedance', local: false }
const ADDRESS = 'http://127.0.0.1:8188'
const IMAGE_FLOW = { job: 'image', status: 'proven', offered: true, label: 'MOSS text to image' }

function setup(providers?: ProviderInfo[], video = 'fal-seedance') {
  const state = baseState()
  const fake = makeFakeApi(
    baseState({
      providers: providers ?? [...state.providers, COMFY, FAKE],
      settings: {
        ...state.settings,
        defaultProviders: { ...state.settings.defaultProviders, image: 'gemini', video },
      },
    }),
  )
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: { address: ADDRESS, workflows: [IMAGE_FLOW], leavesOnServer: [] },
  }))
  fake.onQuery('campaign.paidCount', () => ({
    ok: true,
    data: { pictures: 3, videos: 1, text: 0 },
  }))
  return fake
}

// A caller as the editor's: it sends the run from onConfirm, and notes the words that described
// the dialog at that moment (the last is the cost line).
async function open(over: Partial<RunDialogProps> = {}, fake = setup()) {
  const seen: string[][] = []
  const onConfirm = vi.fn(async (provider: string, count: number | null, video?: unknown) => {
    const ids = screen.getByRole('dialog').getAttribute('aria-describedby') ?? ''
    seen.push(ids.split(' ').map((id) => document.getElementById(id)?.textContent ?? ''))
    return fake.api.command('generation.runImages', { provider, count, video })
  })
  const props: RunDialogProps = {
    open: true,
    projectId: 'P1',
    job: 'image',
    title: 'Make pictures',
    confirmLabel: 'Generate',
    onConfirm,
    onCancel: vi.fn(),
    ...over,
  }
  const view = await renderApp(<RunDialog {...props} />, fake)
  const element = await screen.findByRole('dialog', { name: props.title })
  await act(async () => {})
  return { ...view, element, dialog: within(element), onConfirm, seen, fake }
}

const runs = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'generation.runImages')
const PICTURES = { label: 'Pictures', value: 4, min: 1, max: 8 }
const action = (name = 'Generate') => screen.getByRole('button', { name })

describe('the run dialog sends only on its action click [DLG-4a, C-15]', () => {
  it('sends nothing on open or on a change of provider or count; one click sends one run as shown', async () => {
    const { dialog, fake, onConfirm, seen } = await open({ count: PICTURES, referenceCount: 3 })
    expect(fake.commands).toEqual([])
    await userEvent.click(dialog.getByRole('radio', { name: 'Fake provider' }))
    await userEvent.click(dialog.getByRole('radio', { name: 'Google Gemini' }))
    await userEvent.clear(dialog.getByRole('spinbutton', { name: 'Pictures' }))
    await userEvent.type(dialog.getByRole('spinbutton', { name: 'Pictures' }), '2')
    expect(fake.commands).toEqual([])
    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      dialog.getByText(costLine('Paid: 2 pictures + 3 references → Google Gemini')),
    ).toBeVisible()
    await userEvent.click(action())
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(runs(fake)).toEqual([
      { name: 'generation.runImages', input: { provider: 'gemini', count: 2, video: undefined } },
    ])
    expect(seen[0]?.at(-1)).toBe('Paid: 2 pictures + 3 references to Google Gemini')
  })

  it('puts the MoneyLine words in the description, last in the body, directly above the foot', async () => {
    const { element, dialog } = await open({ count: PICTURES, referenceCount: 3 })
    expect(element).toHaveAccessibleDescription('Paid: 4 pictures + 3 references to Google Gemini')
    const line = dialog.getByText(costLine('Paid: 4 pictures + 3 references → Google Gemini'))
    const foot = line.nextElementSibling as HTMLElement
    expect(
      within(foot)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cancel', 'Generate'])
    expect(foot.nextElementSibling).toBeNull()
  })

  it.each([
    ['1', 0, 'Paid: 1 picture → Google Gemini'],
    ['3', 1, 'Paid: 3 pictures + 1 reference → Google Gemini'],
    ['8', 2, 'Paid: 8 pictures + 2 references → Google Gemini'],
  ])(
    'names %s pictures and %i references, as the command counts them',
    async (typed, refs, words) => {
      const { dialog, fake, seen } = await open({ count: PICTURES, referenceCount: refs })
      const field = dialog.getByRole('spinbutton', { name: 'Pictures' })
      await userEvent.clear(field)
      await userEvent.type(field, typed)
      expect(dialog.getByText(costLine(words))).toBeVisible()
      await userEvent.click(action())
      expect(runs(fake)[0]?.input).toMatchObject({ provider: 'gemini', count: Number(typed) })
      expect(seen[0]?.join(' ')).toBe(spoken(words))
    },
  )
})

describe('the video cost line [DLG-4a, R2E-8]', () => {
  const videoFake = () => setup([FAKE, FAL, COMFY])

  it('names the seconds and pictures it sends, as onConfirm gets them', async () => {
    const { element, onConfirm, seen } = await open(
      {
        job: 'video',
        title: 'Make a video',
        video: { start: 'reference', seconds: 5 },
        referenceCount: 12,
      },
      videoFake(),
    )
    const words = 'Paid: 1 video, 5 seconds + 9 pictures → fal.ai Seedance'
    expect(element).toHaveAccessibleDescription(spoken(words))
    await userEvent.click(action())
    expect(onConfirm).toHaveBeenCalledWith('fal-seedance', null, { seconds: 5, pictures: 9 })
    expect(seen[0]?.at(-1)).toBe(spoken(words))
  })

  it('keeps the length line directly above the cost line, both in the description', async () => {
    const { element, dialog, onConfirm } = await open(
      { job: 'video', title: 'Make a video', video: { start: 'prompt', seconds: 2 } },
      videoFake(),
    )
    const length = 'fal.ai Seedance makes clips of 4 to 15 seconds, so this one will be 4 seconds.'
    const line = dialog.getByText(costLine('Paid: 1 video, 4 seconds → fal.ai Seedance'))
    expect(line.previousElementSibling).toHaveTextContent(length)
    expect(element).toHaveAccessibleDescription(
      `${length} Paid: 1 video, 4 seconds to fal.ai Seedance`,
    )
    await userEvent.click(action())
    expect(onConfirm).toHaveBeenCalledWith('fal-seedance', null, { seconds: 4, pictures: 0 })
  })
})

const noMoneyLine = (scope: ReturnType<typeof within>) =>
  scope.queryByText(
    (_c: string, el: Element | null) => /^Paid:/.test(el?.textContent ?? '') && el?.tagName === 'P',
  )

describe('local lines and unknown providers [DLG-4a]', () => {
  it.each([
    [
      'ComfyUI',
      `This runs on your ComfyUI server at ${ADDRESS} with the workflow MOSS text to image. Nothing is charged.`,
    ],
    ['Fake provider', 'This uses the fake provider. Nothing is charged.'],
  ])('%s keeps its plain line, in the description, and draws no MoneyLine', async (name, words) => {
    const { element, dialog } = await open({ count: PICTURES })
    await userEvent.click(dialog.getByRole('radio', { name }))
    expect(dialog.getByText(words)).toBeVisible()
    expect(element).toHaveAccessibleDescription(words)
    expect(noMoneyLine(dialog)).toBeNull()
  })

  it('counts a retried provider the app does not know as paid', async () => {
    const { element, onConfirm } = await open({
      title: 'Retry the run',
      confirmLabel: 'Retry',
      retry: { provider: 'mystery-cloud' },
      count: { ...PICTURES, value: 2 },
    })
    expect(element).toHaveAccessibleDescription('Paid: 2 pictures to mystery-cloud')
    await userEvent.click(action('Retry'))
    expect(onConfirm).toHaveBeenCalledWith('mystery-cloud', 2)
  })
})

describe('one run per click [DLG-4a]', () => {
  it.each<[string, Partial<RunDialogProps>, ProviderInfo[] | undefined]>([
    ['a picture run', { count: PICTURES }, undefined],
    [
      'a video run',
      { job: 'video', title: 'Make a video', video: { start: 'prompt', seconds: 5 } },
      [FAKE, FAL],
    ],
  ])('disables the action from the click to the reply for %s', async (_name, over, providers) => {
    let answer: (r: Result<unknown>) => void = () => {}
    const onConfirm = vi.fn(() => new Promise<Result<unknown>>((resolve) => (answer = resolve)))
    await open({ ...over, onConfirm }, setup(providers))
    fireEvent.click(action())
    fireEvent.click(action())
    expect(action()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(onConfirm).toHaveBeenCalledOnce()
    await act(async () => answer({ ok: true, data: null }))
    expect(action()).toBeEnabled()
  })
})

describe('provider choices and the no-provider alert [DLG-4a]', () => {
  it('gives a disabled choice only its name, and its reason in title', async () => {
    const { dialog } = await open({ referenceCount: 2 })
    expect(dialog.getByRole('radio', { name: 'Adobe Firefly' })).toHaveAttribute(
      'title',
      'Not yet available',
    )
    expect(dialog.getByRole('radio', { name: 'ComfyUI' })).toHaveAttribute(
      'title',
      'No workflow for this yet',
    )
  })

  it('gives a video provider that cannot start this way its reason', async () => {
    const { dialog } = await open(
      { job: 'video', title: 'Make a video', video: { start: 'background', seconds: 4 } },
      setup([FAKE, FAL, COMFY]),
    )
    const comfy = dialog.getByRole('radio', { name: 'ComfyUI' })
    expect(comfy).toBeDisabled()
    expect(comfy).toHaveAttribute('title', 'Cannot start this way')
  })

  it('draws a select named Provider for five or more providers, and sends what it shows', async () => {
    const extra = ['one', 'two'].map((id) => ({ ...FAKE, id, label: `Stand-in ${id}` }))
    const state = baseState()
    const { dialog, onConfirm } = await open(
      { count: PICTURES },
      setup([...state.providers, COMFY, FAKE, ...extra]),
    )
    const select = dialog.getByRole('combobox', { name: 'Provider' })
    expect(within(select).getByRole('option', { name: 'Adobe Firefly' })).toHaveAttribute(
      'title',
      'Not yet available',
    )
    await userEvent.selectOptions(select, 'Stand-in two')
    expect(dialog.getByText('This runs on Stand-in two. Nothing is charged.')).toBeVisible()
    await userEvent.click(action())
    expect(onConfirm).toHaveBeenCalledWith('two', 4)
  })

  it('shows the warn alert with Settings when no provider can do the run', async () => {
    const state = baseState()
    const { dialog, store, fake } = await open(
      { job: 'cutout' },
      setup([...state.providers, COMFY]),
    )
    const alert = dialog.getByRole('alert')
    expect(alert).toHaveTextContent('No provider can do this yet.')
    expect(action()).toBeDisabled()
    await userEvent.click(within(alert).getByRole('button', { name: 'Settings' }))
    expect(store.getState().view).toEqual({ kind: 'settings' })
    expect(fake.commands).toEqual([])
  })
})

describe('the paid count in the run dialog [DLG-4a, OI-DW-7]', () => {
  it('shows the short mark with the full sentence as its tip, above the cost line; axe clean', async () => {
    const { dialog } = await open({ campaignId: 'C1', count: PICTURES })
    const mark = await dialog.findByTitle(
      'Paid generations for this campaign so far: 3 pictures, 1 videos.',
    )
    expect(mark).toHaveTextContent('Paid so far: 3 pictures, 1 video')
    const line = dialog.getByText(costLine('Paid: 4 pictures → Google Gemini'))
    expect(mark.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(await axeViolations()).toEqual([])
  })
})
