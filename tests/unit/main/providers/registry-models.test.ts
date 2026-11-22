import { describe, it, expect } from 'vitest'
import { listProviders } from '@/main/providers/registry'

const byId = (id: string) => listProviders({}).find((p) => p.id === id)!

describe('the registry names the model of each job [R3-2]', () => {
  it('names Gemini’s picture, layout and text models', () => {
    expect(byId('gemini').modelLabels).toEqual({
      image: 'Nano Banana 2.1',
      layout: 'Gemini 3.5 Flash-Lite',
      text: 'Gemini 3.5 Flash-Lite',
    })
  })

  it('names fal’s video model', () => {
    expect(byId('fal-seedance').modelLabels).toEqual({ video: 'Seedance 2.0' })
  })

  it('names a model for every job that has a default model, and no other', () => {
    for (const p of listProviders({ ADMAN_FAKE_PROVIDERS: '1' })) {
      expect(Object.keys(p.modelLabels ?? {}).sort()).toEqual(Object.keys(p.defaultModels).sort())
    }
  })

  it('gives ComfyUI no fixed model name: its workflow names it', () => {
    expect(byId('comfyui').modelLabels).toEqual({})
  })
})
