// P4-12 (spec/screens-ai.md, "The run confirmation dialog", "What the run does"): one line per
// provider kind, paid, ComfyUI and the fake provider.
import { describe, expect, it } from 'vitest'
import { runSummary, type SummaryInput } from '@/renderer/dialogs/run-dialog/run-summary'
import type { ProviderInfo } from '@/shared/schemas/queries/app'

function provider(id: string, label: string, local: boolean): ProviderInfo {
  return {
    id,
    label,
    jobs: ['image', 'layout', 'text', 'cutout'],
    available: true,
    secrets: [],
    defaultModels: {},
    local,
    cancel: 'none',
    serverText: false,
  }
}

const GEMINI = provider('gemini', 'Google Gemini', false)
const COMFY = provider('comfyui', 'ComfyUI', true)
const FAKE = provider('fake', 'Fake provider', true)
const COMFY_RUN = { address: 'http://127.0.0.1:8188', label: 'MOSS text to image' }

describe('runSummary [P4-12]', () => {
  it.each<[string, SummaryInput, string]>([
    [
      'paid pictures',
      { job: 'image', provider: GEMINI, count: 4 },
      'This will use 4 generation(s) with Google Gemini.',
    ],
    [
      'paid pictures with references',
      { job: 'image', provider: GEMINI, count: 2, referenceCount: 3 },
      'This will use 2 generation(s) with Google Gemini. It sends 3 reference picture(s).',
    ],
    [
      'paid pictures with no references',
      { job: 'image', provider: GEMINI, count: 1, referenceCount: 0 },
      'This will use 1 generation(s) with Google Gemini.',
    ],
    [
      'a paid cut-out, one picture',
      { job: 'cutout', provider: GEMINI },
      'This will use 1 generation(s) with Google Gemini.',
    ],
    [
      'a paid layout request',
      { job: 'layout', provider: GEMINI },
      'This sends 1 paid request to Google Gemini.',
    ],
    [
      'a paid text request, whatever the options count',
      { job: 'text', provider: GEMINI, count: 3 },
      'This sends 1 paid request to Google Gemini.',
    ],
    [
      'ComfyUI with the address and workflow',
      { job: 'image', provider: COMFY, count: 2, comfy: COMFY_RUN },
      'This runs on your ComfyUI server at http://127.0.0.1:8188 with the workflow MOSS text to image. Nothing is charged.',
    ],
    [
      'ComfyUI with no saved address',
      { job: 'cutout', provider: COMFY, comfy: { address: null, label: 'BiRefNet cut-out' } },
      'This runs on your ComfyUI server with the workflow BiRefNet cut-out. Nothing is charged.',
    ],
    [
      'the fake provider',
      { job: 'image', provider: FAKE, count: 4, referenceCount: 2 },
      'This uses the fake provider. Nothing is charged.',
    ],
  ])('%s', (_name, input, line) => {
    expect(runSummary(input)).toBe(line)
  })
})
