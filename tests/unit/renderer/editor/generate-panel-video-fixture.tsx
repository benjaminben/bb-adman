// The Generate panel on a video post's background layer (R2E-8, round-2-editor.md D4), with
// the providers, comfy.getInfo and asset.list a test gives, and the steps to start a video.
// Every provider here is a stand-in: fal.ai only ever reaches the fake API's recorder.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect } from 'vitest'
import { GeneratePanel } from '@/renderer/editor/generate-panel'
import { LicenceDialog } from '@/renderer/dialogs/licence-dialog'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SecretName } from '@/shared/schemas/secrets'
import { baseState } from '../fake-api'
import { renderApp } from '../render'
import { campaignApi, sent } from '../screens/campaign/campaign-fixture'
import { COMFY, INFO, PAID_VIDEO } from '../screens/campaign/video-fixture'
import { assetRow, BACKGROUND, P } from './editor-fixture'

export { COMFY, P }

export const FAKE_VIDEO: ProviderInfo = {
  id: 'fake',
  label: 'Fake provider',
  jobs: ['image', 'video'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops',
  serverText: false,
}

const [FIRST_FRAME, PROMPT_ONLY] = INFO.workflows as [WorkflowInfo, WorkflowInfo]
const REFERENCE = {
  ...PROMPT_ONLY,
  id: 'h3-reference-to-video',
  videoStart: { firstFrame: false, references: true },
  video: { fps: 24, maxMs: 10_000, frameStep: 17, frameOffset: 5 },
} as WorkflowInfo

// ComfyUI's three H3 video workflows. Most: 15 s from a prompt, 30 s from a first frame, 10 s
// from a reference.
export const INFO_ALL: ComfyInfo = { ...INFO, workflows: [FIRST_FRAME, PROMPT_ONLY, REFERENCE] }
// No first-frame workflow listed.
export const INFO_NO_FRAME: ComfyInfo = { ...INFO, workflows: [PROMPT_ONLY, REFERENCE] }
export const FAL = PAID_VIDEO.find((p) => p.id === 'fal-seedance') as ProviderInfo
export const WITH_FAL = [FAKE_VIDEO, FAL]
export const A1 = assetRow('A1')

type Row = AssetList[number]
export type PanelOpts = {
  providers?: ProviderInfo[]
  video?: string
  info?: ComfyInfo
  rows?: Row[]
  layer?: LayerRow
  format?: 'image' | 'video'
  licence?: boolean
  // The names of the saved keys.
  keys?: SecretName[]
}

export async function openVideo(opts: PanelOpts = {}) {
  const settings = baseState().settings
  const fake = campaignApi({
    state: {
      providers: opts.providers ?? [FAKE_VIDEO],
      secrets: (opts.keys ?? []).map((name) => ({ name, lastFour: '1234' })),
      settings: {
        ...settings,
        defaultProviders: { ...settings.defaultProviders, video: opts.video ?? 'fake' },
      },
    },
  })
  const list = { rows: opts.rows ?? [A1] }
  fake.onQuery('asset.list', () => ({ ok: true, data: list.rows }))
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: opts.info ?? INFO_ALL }))
  fake.onCommand('generation.startVideo', () => ({ ok: true, data: { jobId: 'J7' } }))
  await renderApp(
    <main>
      <GeneratePanel
        projectId={P}
        campaignId="C1"
        layer={opts.layer ?? BACKGROUND}
        format={opts.format ?? 'video'}
      />
      {opts.licence && <LicenceDialog />}
    </main>,
    fake,
  )
  await waitFor(() => expect(screen.getByLabelText('Prompt')).toBeEnabled())
  return { fake, list, panel: within(screen.getByRole('region', { name: 'Generate' })) }
}

export const makeGroup = () => within(screen.getByRole('group', { name: 'Make' }))
// ED-4a: the start choices are pressed-state tiles in the group "Start from".
export const starts = () => within(screen.getByRole('group', { name: 'Start from' }))
export const startLabels = () =>
  starts()
    .getAllByRole('button')
    .map((r) => r.textContent)
export const generateButton = () => screen.getByRole('button', { name: 'Generate…' })
export const clipLength = () => screen.getByLabelText('Clip length (seconds)')

export async function chooseStart(name: string) {
  await userEvent.click(starts().getByRole('button', { name }))
}

// Opens the run dialog; the caller confirms or cancels.
export async function openDialog() {
  await userEvent.click(generateButton())
  return within(await screen.findByRole('dialog', { name: 'Make a video' }))
}

// Generate… then the dialog's own Generate.
export async function generateVideo() {
  const dialog = await openDialog()
  await waitFor(() => expect(dialog.getByRole('button', { name: 'Generate' })).toBeEnabled())
  await userEvent.click(dialog.getByRole('button', { name: 'Generate' }))
  return dialog
}

export const videoInputs = (fake: Awaited<ReturnType<typeof openVideo>>['fake']) =>
  sent(fake, 'generation.startVideo').map((c) => c.input)

export const ALL_VIDEO_STARTS = [
  'A prompt only',
  "This layer's picture",
  'Another picture of the same shape…',
  'Reference pictures',
]
