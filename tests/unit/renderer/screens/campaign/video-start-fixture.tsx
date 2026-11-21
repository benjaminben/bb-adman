// Answers and steps for the "Start from" tests of the video card (SPEC 14 1.60 CU-6b-R N-9,
// N-10): a comfy.getInfo reply with all three H3 video workflows, each with its own most, the
// project's reference pictures from asset.list, and the card's controls.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect } from 'vitest'
import { CampaignView } from '../../../../../src/renderer/screens/campaign/campaign-view'
import { ErrorBanner } from '../../../../../src/renderer/app/error-banner'
import type { ProviderInfo } from '../../../../../src/shared/schemas/queries/app'
import type { AssetList } from '../../../../../src/shared/schemas/queries/asset'
import type { ComfyInfo, WorkflowInfo } from '../../../../../src/shared/schemas/queries/comfy'
import { P, renderWith } from './campaign-fixture'
import { ref } from './reference-fixture'
import { INFO, videoApi } from './video-fixture'

const [FIRST_FRAME, PROMPT_ONLY] = INFO.workflows as [WorkflowInfo, WorkflowInfo]

const REFERENCE = {
  ...PROMPT_ONLY,
  id: 'h3-reference-to-video',
  videoStart: { firstFrame: false, references: true },
  video: { fps: 24, maxMs: 10_000, frameStep: 17, frameOffset: 5 },
} as WorkflowInfo

// Most: 15 s from a prompt, 30 s from a first frame, 10 s from a reference.
export const INFO_ALL: ComfyInfo = { ...INFO, workflows: [FIRST_FRAME, PROMPT_ONLY, REFERENCE] }

// No first-frame workflow listed.
export const INFO_NO_FRAME: ComfyInfo = { ...INFO, workflows: [PROMPT_ONLY, REFERENCE] }

export const HINT = 'Tip: call the picture <Picture 1> in the prompt.'

type Ref = AssetList[number]

type PictureOpts = { info?: ComfyInfo; providers?: ProviderInfo[] }

export function pictureApi(rows: Ref[], opts: PictureOpts = {}) {
  const fake = videoApi({ providers: opts.providers })
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: opts.info ?? INFO_ALL }))
  const list = { rows }
  fake.onQuery('asset.list', () => ({ ok: true, data: list.rows }))
  return { fake, list }
}

export const view = (
  <>
    <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />
    <ErrorBanner />
  </>
)

// The card, once comfy.getInfo has given the prompt start's most.
export async function panel(fake = pictureApi([ref('A1'), ref('A2')]).fake) {
  await renderWith(view, fake)
  const p = within(await screen.findByRole('region', { name: 'Make a video' }))
  await waitFor(() => expect(p.getByLabelText('Length (seconds)')).toHaveAttribute('max', '15'))
  return { fake, p }
}

export type Panel = Awaited<ReturnType<typeof panel>>['p']

export const startFrom = (p: Panel) => p.getByLabelText('Start from')
export const start = (p: Panel) => p.getByRole('button', { name: 'Start' })

export async function pictureStart(p: Panel, label: string) {
  await userEvent.selectOptions(startFrom(p), label)
  return within(await p.findByRole('region', { name: 'Picture to start from' }))
}

export const FIELDS = { projectId: P, variantId: 'V1', prompt: 'A can', provider: 'comfyui' }
