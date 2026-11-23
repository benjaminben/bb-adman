// CW-5 (spec/comfyui-custom.md, "Screens", the workflow picker): the "Workflow" select in the
// run dialog shows only with ComfyUI chosen, not on a retry, and with two or more fitting
// workflows. It starts at the remembered choice when it fits, else the default; the cost line
// names the picked workflow, Generate hands its ID on, and the choice is remembered only after
// an accepted reply. onConfirm is a mock, so no run is sent.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RunDialog, type RunDialogProps } from '@/renderer/dialogs/run-dialog'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { Result } from '@/shared/schemas/result'
import type { Settings } from '@/shared/schemas/settings'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { info, workflow } from '../screens/settings/comfy-fixture'
import {
  HARBOUR_FIRST,
  PORTRAIT,
  TIDE_CLIP,
  customWorkflow,
} from '../screens/settings/custom-workflow-fixture'

const COMFY: ProviderInfo = {
  id: 'comfyui',
  label: 'ComfyUI',
  jobs: ['image', 'video'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops',
  serverText: false,
}
const FAKE: ProviderInfo = { ...COMFY, id: 'fake', label: 'Fake provider' }
const ADDRESS = 'http://192.168.1.50:8188'

const MOSS = workflow({ label: 'MOSS picture from a prompt', status: 'proven' })
const NIGHT = customWorkflow(
  { id: 'custom-5a6b7c8d9e0f', label: 'Night poster', model: { label: 'Night', mainFile: 'x' } },
  { addedBy: 'agent' },
)
const H3_FRAME = workflow({
  id: 'h3-image-to-video',
  label: 'H3 from a first frame',
  job: 'video',
  videoStart: { firstFrame: true, references: false },
  video: { fps: 24, maxMs: 30_000, frameStep: 17, frameOffset: 5 },
})
const FLOWS = [MOSS, PORTRAIT, NIGHT, H3_FRAME, HARBOUR_FIRST, TIDE_CLIP]

type Opts = {
  flows?: WorkflowInfo[]
  choice?: Settings['comfyWorkflowChoice']
  image?: string
  reply?: Result<unknown>
}

function setup(opts: Opts = {}) {
  const state = baseState()
  const fake = makeFakeApi(
    baseState({
      providers: [FAKE, COMFY],
      settings: {
        ...state.settings,
        defaultProviders: { ...state.settings.defaultProviders, image: opts.image ?? 'comfyui' },
        comfyWorkflowChoice: opts.choice ?? {},
      },
    }),
  )
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: info({ address: ADDRESS, workflows: opts.flows ?? FLOWS }),
  }))
  return fake
}

async function open(over: Partial<RunDialogProps> = {}, opts: Opts = {}) {
  const fake = setup(opts)
  const accepted: Result<unknown> = { ok: true, data: { jobId: 'J1' } }
  const onConfirm = vi.fn(async () => opts.reply ?? accepted)
  const props: RunDialogProps = {
    open: true,
    projectId: 'P1',
    job: 'image',
    title: 'Make pictures',
    confirmLabel: 'Generate',
    count: { label: 'Pictures', value: 2, min: 1, max: 8 },
    onConfirm,
    onCancel: () => {},
    ...over,
  }
  await renderApp(<RunDialog {...props} />, fake)
  const dialog = within(await screen.findByRole('dialog', { name: props.title }))
  await act(async () => {})
  return { dialog, onConfirm, fake }
}

const picker = () => screen.queryByRole('combobox', { name: 'Workflow' })
const options = () =>
  within(screen.getByRole('combobox', { name: 'Workflow' }))
    .getAllByRole('option')
    .map((o) => o.textContent)
const generate = (dialog: ReturnType<typeof within>) =>
  userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
const updates = (fake: ReturnType<typeof setup>) =>
  fake.commands.filter((c) => c.name === 'settings.update')

describe('the Workflow picker shows [CW-5]', () => {
  it('lists the fitting workflows in comfy.getInfo order, an agent one marked in its words', async () => {
    await open()
    expect(options()).toEqual([
      'MOSS picture from a prompt',
      'Studio portrait',
      'Night poster (added by an agent)',
    ])
  })

  it('does not show with another provider chosen', async () => {
    await open({}, { image: 'fake' })
    expect(picker()).toBeNull()
    await userEvent.click(screen.getByRole('radio', { name: /^ComfyUI/ }))
    expect(picker()).toBeInTheDocument()
  })

  it('does not show on a retry', async () => {
    await open({ title: 'Retry the run', confirmLabel: 'Retry', retry: { provider: 'comfyui' } })
    expect(picker()).toBeNull()
  })

  it('a retry hands on no workflow and remembers nothing', async () => {
    const { dialog, onConfirm, fake } = await open({
      title: 'Retry the run',
      confirmLabel: 'Retry',
      retry: { provider: 'comfyui' },
    })
    await userEvent.click(dialog.getByRole('button', { name: 'Retry' }))
    expect(onConfirm).toHaveBeenCalledWith('comfyui', 2)
    expect(updates(fake)).toEqual([])
  })

  it('a workflow picked before switching to another provider is not sent or remembered', async () => {
    const { dialog, onConfirm, fake } = await open()
    await userEvent.selectOptions(picker() as HTMLElement, PORTRAIT.id)
    await userEvent.click(screen.getByRole('radio', { name: 'Fake provider' }))
    expect(picker()).toBeNull()
    await generate(dialog)
    expect(onConfirm).toHaveBeenCalledWith('fake', 2)
    expect(updates(fake)).toEqual([])
  })

  it('does not show with one fitting workflow, and the dialog sends no ID', async () => {
    const { dialog, onConfirm, fake } = await open({}, { flows: [MOSS, TIDE_CLIP] })
    expect(picker()).toBeNull()
    await generate(dialog)
    expect(onConfirm).toHaveBeenCalledWith('comfyui', 2)
    expect(updates(fake)).toEqual([])
  })

  it('lists the first-frame workflows for a video from a first frame', async () => {
    await open({
      job: 'video',
      title: 'Make a video',
      count: undefined,
      video: { start: 'first_frame', seconds: 4 },
      referenceCount: 1,
    })
    expect(options()).toEqual(['H3 from a first frame', 'Harbour from a first frame'])
  })

  it('has no accessibility violations', async () => {
    await open()
    expect(await axeViolations(document.body)).toEqual([])
  })
})

describe('where the picker starts [CW-5]', () => {
  it('starts at the remembered workflow when it fits', async () => {
    await open({}, { choice: { image: PORTRAIT.id } })
    expect(picker()).toHaveValue(PORTRAIT.id)
  })

  it.each([
    ['removed', { image: 'custom-ffffffffffff' }],
    ['for another job', { image: TIDE_CLIP.id }],
    ['for another kind of run', { image_refs: PORTRAIT.id }],
  ] as const)('starts at the default when the remembered one is %s', async (_name, choice) => {
    await open({}, { choice })
    expect(picker()).toHaveValue(MOSS.id)
  })
})

describe('what the click sends [CW-5]', () => {
  it('names the picked workflow and its model, and hands its ID on', async () => {
    const { dialog, onConfirm } = await open()
    await userEvent.selectOptions(picker() as HTMLElement, NIGHT.id)
    expect(
      dialog.getByText(
        `This runs on your ComfyUI server at ${ADDRESS} with the workflow Night poster. Nothing is charged.`,
      ),
    ).toBeVisible()
    expect(screen.getByRole('radio', { name: 'ComfyUI · Night' })).toBeChecked()
    await generate(dialog)
    expect(onConfirm).toHaveBeenCalledWith('comfyui', 2, undefined, NIGHT.id)
  })

  it('remembers the picked workflow for the kind of run after an accepted reply', async () => {
    const { dialog, fake } = await open()
    await userEvent.selectOptions(picker() as HTMLElement, PORTRAIT.id)
    expect(updates(fake)).toEqual([])
    await generate(dialog)
    await waitFor(() =>
      expect(updates(fake)).toEqual([
        { name: 'settings.update', input: { comfyWorkflowChoice: { image: PORTRAIT.id } } },
      ]),
    )
  })

  it('does not remember a choice whose run was refused', async () => {
    const reply: Result<unknown> = {
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'That ComfyUI workflow is not on this computer.' },
    }
    const { dialog, fake } = await open({}, { reply })
    await userEvent.selectOptions(picker() as HTMLElement, PORTRAIT.id)
    await generate(dialog)
    expect(await dialog.findByText('That ComfyUI workflow is not on this computer.')).toBeVisible()
    expect(updates(fake)).toEqual([])
  })

  it('names the picked video workflow and remembers it for the start', async () => {
    const { dialog, onConfirm, fake } = await open({
      job: 'video',
      title: 'Make a video',
      count: undefined,
      video: { start: 'first_frame', seconds: 4 },
      referenceCount: 1,
    })
    await userEvent.selectOptions(picker() as HTMLElement, HARBOUR_FIRST.id)
    expect(dialog.getByText(/with the workflow Harbour from a first frame\./)).toBeVisible()
    await generate(dialog)
    expect(onConfirm).toHaveBeenCalledWith(
      'comfyui',
      null,
      { seconds: 4, pictures: 1 },
      HARBOUR_FIRST.id,
    )
    await waitFor(() =>
      expect(updates(fake)[0]?.input).toEqual({
        comfyWorkflowChoice: { video_first_frame: HARBOUR_FIRST.id },
      }),
    )
  })
})

describe('the retry line [CW-5]', () => {
  it('says the run uses the same workflow as before', async () => {
    const { dialog } = await open({
      title: 'Retry the run',
      confirmLabel: 'Retry',
      retry: { provider: 'comfyui' },
    })
    expect(
      dialog.getByText(
        `This runs on your ComfyUI server at ${ADDRESS} with the same workflow as before. Nothing is charged.`,
      ),
    ).toBeVisible()
  })
})
