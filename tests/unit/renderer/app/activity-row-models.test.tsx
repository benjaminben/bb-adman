// R3-2: a job's progress and failure lines name the model that runs it.
import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ActivityRow } from '@/renderer/app/activity-row'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const GEMINI: ProviderInfo = {
  ...baseState().providers[0]!,
  defaultModels: { image: 'gemini-nano-banana-2.1' },
  modelLabels: { image: 'Nano Banana 2.1' },
}
const COMFY: ProviderInfo = {
  id: 'comfyui',
  label: 'ComfyUI',
  jobs: ['image', 'video', 'cutout'],
  available: true,
  secrets: [],
  defaultModels: {},
  modelLabels: {},
  local: true,
  cancel: 'stops',
  serverText: true,
}
const PLACE = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: 'Can' }
const WORKFLOW = {
  job: 'cutout',
  offered: true,
  status: 'proven',
  model: { label: 'BiRefNet', mainFile: 'birefnet.pth' },
}

async function draw(over: Partial<JobRow>) {
  const fake = makeFakeApi(baseState({ providers: [GEMINI, COMFY] }))
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: { address: null, workflows: [WORKFLOW], leavesOnServer: [] },
  }))
  await renderApp(
    <ul aria-label="Jobs">
      <ActivityRow
        entry={{ job: jobRow('J1', { layerId: 'L1', ...over }), place: PLACE }}
        projectId="P1"
        onGo={() => {}}
      />
    </ul>,
    fake,
  )
  await act(async () => {})
}

describe('ActivityRow names the model [R3-2]', () => {
  it('names the stored model in the job’s line', async () => {
    await draw({ model: 'gemini-nano-banana-2.1', status: 'running' })
    expect(screen.getByText('Pictures (2) · Google Gemini · Nano Banana 2.1')).toBeVisible()
  })

  it('names a ComfyUI job’s model by its workflow', async () => {
    await draw({ provider: 'comfyui', model: '', kind: 'cutout', status: 'running' })
    expect(screen.getByText('Cut-out · ComfyUI · BiRefNet')).toBeVisible()
  })

  it('names the model in the failure sentence', async () => {
    await draw({ model: 'gemini-nano-banana-2.1', status: 'failed', errorKind: 'quota' })
    expect(screen.getByText(/Google Gemini · Nano Banana 2\.1/, { selector: 'p' })).toBeVisible()
  })
})
