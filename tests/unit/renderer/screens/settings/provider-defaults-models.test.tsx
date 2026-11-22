// R3-2: Settings' provider defaults name the model each provider runs for the job.
import { act, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProviderDefaults } from '@/renderer/screens/settings/provider-defaults/provider-defaults'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { renderApp } from '../../render'
import { baseState, makeFakeApi } from '../../fake-api'

const REMOTE = {
  available: true,
  secrets: [],
  local: false,
  cancel: 'none' as const,
  serverText: false,
}
const GEMINI: ProviderInfo = {
  ...REMOTE,
  id: 'gemini',
  label: 'Google Gemini',
  jobs: ['image', 'layout', 'text'],
  defaultModels: { image: 'a', layout: 'b', text: 'b' },
  modelLabels: {
    image: 'Nano Banana 2.1',
    layout: 'Gemini 3.5 Flash-Lite',
    text: 'Gemini 3.5 Flash-Lite',
  },
}
const FAL: ProviderInfo = {
  ...REMOTE,
  id: 'fal-seedance',
  label: 'fal.ai Seedance',
  jobs: ['video'],
  defaultModels: { video: 'c' },
  modelLabels: { video: 'Seedance 2.0' },
}
const COMFY: ProviderInfo = {
  ...REMOTE,
  id: 'comfyui',
  label: 'ComfyUI',
  jobs: ['image', 'video'],
  defaultModels: {},
  modelLabels: {},
  local: true,
}
const flow = (job: string, label: string) => ({
  job,
  offered: true,
  status: 'proven',
  model: { label, mainFile: `${label}.bin` },
})

async function draw() {
  const fake = makeFakeApi(baseState({ providers: [GEMINI, FAL, COMFY] }))
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: {
      address: null,
      workflows: [flow('image', 'MOSS-Image'), flow('video', 'MiniMax H3')],
      leavesOnServer: [],
    },
  }))
  await renderApp(<ProviderDefaults />, fake)
  await act(async () => {})
}

describe('provider defaults name the model [R3-2]', () => {
  it('names each image provider with its model, the model on the page', async () => {
    await draw()
    const image = screen.getByRole('group', { name: 'Image generation' })
    expect(
      within(image).getByRole('button', { name: 'Google Gemini · Nano Banana 2.1' }),
    ).toBeVisible()
    expect(within(image).getByRole('button', { name: 'ComfyUI · MOSS-Image' })).toBeVisible()
    expect(within(image).getByText('Nano Banana 2.1')).toBeVisible()
  })

  it('names the video models, saying a shared word once', async () => {
    await draw()
    const video = screen.getByRole('group', { name: 'Video generation' })
    expect(within(video).getByRole('button', { name: 'fal.ai · Seedance 2.0' })).toBeVisible()
    expect(within(video).getByRole('button', { name: 'ComfyUI · MiniMax H3' })).toBeVisible()
  })

  it('names the model of a job with one provider', async () => {
    await draw()
    const layout = screen.getByRole('group', { name: 'Layout' })
    expect(layout).toHaveTextContent('Google · Gemini 3.5 Flash-Lite')
  })
})
