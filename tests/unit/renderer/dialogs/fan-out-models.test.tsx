// R3-2: the fan-out dialog's provider select and cost lines name the model too.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fillCost, translationCost } from '@/renderer/dialogs/fan-out/fan-out-costs'
import { fillProviders } from '@/renderer/dialogs/fan-out/cost-line'
import { ProviderSelect } from '@/renderer/screens/campaign/provider-select'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'

const GEMINI: ProviderInfo = {
  id: 'gemini',
  label: 'Google Gemini',
  jobs: ['image', 'layout', 'text'],
  available: true,
  secrets: [],
  defaultModels: { image: 'a', text: 'b' },
  modelLabels: { image: 'Nano Banana 2.1', text: 'Gemini 3.5 Flash-Lite' },
  local: false,
  cancel: 'none',
  serverText: false,
}
const COMFY: ProviderInfo = {
  ...GEMINI,
  id: 'comfyui',
  label: 'ComfyUI',
  jobs: ['image'],
  defaultModels: {},
  modelLabels: {},
  local: true,
}
const INFO = {
  address: null,
  leavesOnServer: [],
  workflows: [
    { job: 'extend', offered: true, status: 'proven', model: { label: 'MOSS-Image', mainFile: 'm' } },
  ],
} as unknown as ComfyInfo

describe('fan-out names the model [R3-2]', () => {
  it('names the fill model in a paid fill line', () => {
    expect(fillCost(3, GEMINI)?.words).toBe('Paid: 3 fills → Google Gemini · Nano Banana 2.1')
  })

  it('names the ComfyUI extend workflow’s model in a free fill line', () => {
    const { models } = fillProviders([GEMINI, COMFY], INFO)
    expect(fillCost(2, COMFY, models.comfyui)?.words).toBe(
      '2 fills on ComfyUI · MOSS-Image. Nothing is charged.',
    )
  })

  it('names the text model in a paid translation line', () => {
    expect(translationCost(2, GEMINI)?.words).toBe(
      'Paid: up to 2 translations → Google · Gemini 3.5 Flash-Lite',
    )
  })

  it('names each option of the provider select with its model', () => {
    const { list, models } = fillProviders([GEMINI, COMFY], INFO)
    render(
      <ProviderSelect
        label="Provider"
        providers={list}
        models={models}
        value="gemini"
        onChange={() => {}}
        trial={false}
      />,
    )
    expect(screen.getByRole('option', { name: 'Google Gemini · Nano Banana 2.1' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'ComfyUI · MOSS-Image' })).toBeVisible()
  })
})
