// R3-2: the run dialog names the model beside each provider, on a second line under it, and
// the cost line names it too.
import { act, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RunDialog, type RunDialogProps } from '@/renderer/dialogs/run-dialog'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { costLine } from '../cost-line'

const GEMINI: ProviderInfo = {
  id: 'gemini',
  label: 'Google Gemini',
  jobs: ['image', 'layout', 'text'],
  available: true,
  secrets: ['gemini.apiKey'],
  defaultModels: { image: 'gemini-nano-banana-2.1', layout: 'gemini-3.5-flash-lite' },
  modelLabels: { image: 'Nano Banana 2.1', layout: 'Gemini 3.5 Flash-Lite' },
  local: false,
  cancel: 'none',
  serverText: false,
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
const FLOW = {
  job: 'image',
  status: 'proven',
  offered: true,
  label: 'MOSS-Image: picture from a prompt',
  model: { label: 'MOSS-Image', mainFile: 'moss.safetensors' },
}

function setup() {
  const state = baseState()
  const fake = makeFakeApi(baseState({ providers: [GEMINI, COMFY], settings: state.settings }))
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: { address: null, workflows: [FLOW], leavesOnServer: [] },
  }))
  fake.onQuery('campaign.paidCount', () => ({
    ok: true,
    data: { pictures: 0, videos: 0, text: 0 },
  }))
  return fake
}

async function open(over: Partial<RunDialogProps> = {}) {
  const props: RunDialogProps = {
    open: true,
    projectId: 'P1',
    job: 'image',
    title: 'Make pictures',
    confirmLabel: 'Generate',
    count: { label: 'Pictures', value: 4, min: 1, max: 8 },
    onConfirm: vi.fn(async () => ({ ok: true as const, data: null })),
    onCancel: vi.fn(),
    ...over,
  }
  await renderApp(<RunDialog {...props} />, setup())
  await screen.findByRole('dialog', { name: props.title })
  await act(async () => {})
}

describe('run dialog names the model [R3-2]', () => {
  it('names each provider with its model', async () => {
    await open()
    const group = screen.getByRole('group', { name: 'Provider' })
    expect(
      within(group).getByRole('radio', { name: 'Google Gemini · Nano Banana 2.1' }),
    ).toBeChecked()
    expect(within(group).getByRole('radio', { name: 'ComfyUI · MOSS-Image' })).toBeEnabled()
  })

  it('shows the model as its own line, readable without hovering', async () => {
    await open()
    expect(screen.getByText('Nano Banana 2.1')).toBeVisible()
    expect(screen.getByText('MOSS-Image')).toBeVisible()
  })

  it('names the model in the paid cost line', async () => {
    await open()
    expect(
      screen.getByText(costLine('Paid: 4 pictures → Google Gemini · Nano Banana 2.1')),
    ).toBeInTheDocument()
  })

  it('says a shared word once for a layout model', async () => {
    await open({ job: 'layout', count: undefined })
    expect(screen.getByRole('radio', { name: 'Google · Gemini 3.5 Flash-Lite' })).toBeChecked()
    expect(
      screen.getByText(costLine('Paid: 1 request → Google · Gemini 3.5 Flash-Lite')),
    ).toBeInTheDocument()
  })

  it('names the model on a retry, where the provider is shown, not chosen', async () => {
    await open({ retry: { provider: 'gemini' } })
    expect(screen.getByText('Provider: Google Gemini · Nano Banana 2.1')).toBeInTheDocument()
  })
})
