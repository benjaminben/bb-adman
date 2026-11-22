// R2E-8 (spec/phases/round-2-editor.md D4, "The run dialog", for a video): the provider list
// follows the start, the paid line names the length and the pictures that are sent, the
// length is the provider's, and nothing is sent before Confirm. The fake provider only stands
// in for fal.ai here: onConfirm is a mock, so no command is sent at all.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RunDialog, type RunDialogProps } from '@/renderer/dialogs/run-dialog'
import { videoPictures, videoSeconds } from '@/renderer/editor/generate-panel/video-lengths'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { Result } from '@/shared/schemas/result'
import { renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { costLine } from '../cost-line'

const LOCAL = { local: true, cancel: 'stops', serverText: false } as const
const COMFY: ProviderInfo = {
  id: 'comfyui',
  label: 'ComfyUI',
  jobs: ['image', 'video'],
  available: true,
  secrets: [],
  defaultModels: {},
  ...LOCAL,
}
const FAKE: ProviderInfo = { ...COMFY, id: 'fake', label: 'Fake provider' }
const FAL: ProviderInfo = {
  ...COMFY,
  id: 'fal-seedance',
  label: 'fal.ai Seedance',
  local: false,
  jobs: ['video'],
}
// A provider with no offer that is not ComfyUI starts from a prompt only.
const OTHER: ProviderInfo = { ...FAL, id: 'other-video', label: 'Other video' }

const PROMPT_FLOW = {
  id: 'h3-text-to-video',
  label: 'H3 text to video',
  job: 'video',
  videoStart: { firstFrame: false, references: false },
  status: 'trial',
  video: { fps: 24, maxMs: 15_000, frameStep: 17, frameOffset: 5 },
  offered: true,
} as WorkflowInfo
const INFO: ComfyInfo = {
  address: 'http://127.0.0.1:8188',
  workflows: [PROMPT_FLOW],
  leavesOnServer: [],
}

function setup(providers: ProviderInfo[] = [FAKE, FAL, COMFY], video = 'fal-seedance') {
  const state = baseState()
  const fake = makeFakeApi(
    baseState({
      providers,
      settings: {
        ...state.settings,
        defaultProviders: { ...state.settings.defaultProviders, video },
      },
    }),
  )
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: INFO }))
  return fake
}

const ok: Result<unknown> = { ok: true, data: null }

async function open(over: Partial<RunDialogProps> = {}, fake = setup()) {
  const onConfirm = vi.fn(async () => ok)
  const props: RunDialogProps = {
    open: true,
    projectId: 'P1',
    job: 'video',
    title: 'Make a video',
    confirmLabel: 'Generate',
    video: { start: 'prompt', seconds: 2 },
    onConfirm,
    onCancel: () => {},
    ...over,
  }
  await renderApp(<RunDialog {...props} />, fake)
  const dialog = within(await screen.findByRole('dialog', { name: 'Make a video' }))
  await act(async () => {})
  return { dialog, onConfirm }
}

const radios = () =>
  within(screen.getByRole('group', { name: 'Provider' }))
    .getAllByRole('radio')
    .map(
      (r) =>
        `${(r as HTMLInputElement).labels?.[0]?.textContent}${r.hasAttribute('disabled') ? ' [off]' : ''}`,
    )

describe('videoSeconds and videoPictures [R2E-8, D4]', () => {
  it.each([
    ['fal at 2 s is its least, 4 s', 'fal-seedance', 'prompt', 2, 4],
    ['fal at 20 s is its most, 15 s', 'fal-seedance', 'prompt', 20, 15],
    ['fal at 7 s stays', 'fal-seedance', 'prompt', 7, 7],
    ['the fake provider at 2 s stays', 'fake', 'prompt', 2, 2],
    ["ComfyUI at 20 s is its workflow's most, 15 s", 'comfyui', 'prompt', 20, 15],
    ['a provider with no bounds keeps what was typed', 'other-video', 'prompt', 30, 30],
  ] as const)('%s', (_name, id, start, wanted, seconds) => {
    expect(videoSeconds(INFO, id, start, wanted)).toBe(seconds)
  })

  it.each([
    ['prompt', 3, 0],
    ['background', 0, 1],
    ['first_frame', 1, 1],
    ['reference', 12, 9],
    ['reference', 2, 2],
  ] as const)('a %s start with %i chosen sends %i to fal', (start, chosen, sent) => {
    expect(videoPictures('fal-seedance', start, chosen)).toBe(sent)
  })
})

describe('run dialog for a video [R2E-8, D4]', () => {
  it('has the title "Make a video", the confirm "Generate" and no count', async () => {
    const { dialog } = await open()
    expect(dialog.getByRole('button', { name: 'Generate' })).toBeInTheDocument()
    expect(dialog.queryByRole('spinbutton')).toBeNull()
  })

  it.each([
    ['background', ['Fake provider', 'fal.ai Seedance', 'ComfyUI [off]', 'Other video [off]']],
    ['first_frame', ['Fake provider', 'fal.ai Seedance', 'ComfyUI [off]', 'Other video [off]']],
    ['prompt', ['Fake provider', 'fal.ai Seedance', 'ComfyUI', 'Other video']],
  ] as const)('disables the providers that cannot start from %s', async (start, list) => {
    await open({ video: { start, seconds: 2 } }, setup([FAKE, FAL, COMFY, OTHER]))
    expect(radios()).toEqual(list)
  })

  it('starts on the saved video default when it can start this way', async () => {
    await open()
    expect(screen.getByRole('radio', { name: 'fal.ai Seedance' })).toBeChecked()
  })

  it('says fal at 2 s makes 4 s, and hands Confirm the 4 s it named', async () => {
    const { dialog, onConfirm } = await open()
    expect(dialog.getByText(costLine('Paid: 1 video, 4 seconds → fal.ai Seedance'))).toBeVisible()
    expect(
      dialog.getByText(
        'fal.ai Seedance makes clips of 4 to 15 seconds, so this one will be 4 seconds.',
      ),
    ).toBeVisible()
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    expect(onConfirm).toHaveBeenCalledWith('fal-seedance', null, { seconds: 4, pictures: 0 })
  })

  it("names the pictures a paid start sends, cut to the provider's most", async () => {
    const { dialog, onConfirm } = await open({
      video: { start: 'reference', seconds: 5 },
      referenceCount: 12,
    })
    expect(
      dialog.getByText(costLine('Paid: 1 video, 5 seconds + 9 pictures → fal.ai Seedance')),
    ).toBeVisible()
    expect(dialog.queryByText(/makes clips of/)).toBeNull()
    await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
    expect(onConfirm).toHaveBeenCalledWith('fal-seedance', null, { seconds: 5, pictures: 9 })
  })

  it('counts the background picture a background start sends', async () => {
    const { dialog } = await open({ video: { start: 'background', seconds: 4 } })
    expect(
      dialog.getByText(costLine('Paid: 1 video, 4 seconds + 1 picture → fal.ai Seedance')),
    ).toBeVisible()
  })

  it("keeps the fake provider's line, and sends nothing on Cancel", async () => {
    const onCancel = vi.fn()
    const { dialog, onConfirm } = await open({ onCancel }, setup([FAKE, FAL], 'fake'))
    expect(dialog.getByText('This uses the fake provider. Nothing is charged.')).toBeVisible()
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
