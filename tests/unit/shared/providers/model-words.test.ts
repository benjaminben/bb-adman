import { describe, it, expect } from 'vitest'
import {
  jobModel,
  modelList,
  modelNameOf,
  providerModelParts,
  providerModelWords,
  serviceWords,
} from '@/shared/providers/model-words'

const gemini = {
  id: 'gemini',
  label: 'Google Gemini',
  defaultModels: {
    image: 'gemini-nano-banana-2.1',
    layout: 'gemini-3.5-flash-lite',
    text: 'gemini-3.5-flash-lite',
  },
  modelLabels: {
    image: 'Nano Banana 2.1',
    layout: 'Gemini 3.5 Flash-Lite',
    text: 'Gemini 3.5 Flash-Lite',
  },
}
const fal = {
  id: 'fal-seedance',
  label: 'fal.ai Seedance',
  defaultModels: { video: 'bytedance/seedance-2.0/image-to-video' },
  modelLabels: { video: 'Seedance 2.0' },
}
const comfy = { id: 'comfyui', label: 'ComfyUI', defaultModels: {}, modelLabels: {} }
const s3 = { id: 's3', label: 'Amazon S3', defaultModels: {} }
const providers = [gemini, fal, comfy, s3]
const workflows = [{ model: { label: 'MOSS-Image', mainFile: 'moss_image.safetensors' } }]

describe('providerModelWords [R3-2]', () => {
  it('joins the provider and the model with a middle dot', () => {
    expect(providerModelWords('Google Gemini', 'Nano Banana 2.1')).toBe(
      'Google Gemini · Nano Banana 2.1',
    )
    expect(providerModelWords('ComfyUI', 'MOSS-Image')).toBe('ComfyUI · MOSS-Image')
  })

  it('says a word once when the provider ends with the model’s first word', () => {
    expect(providerModelWords('fal.ai Seedance', 'Seedance 2.0')).toBe('fal.ai · Seedance 2.0')
    expect(providerModelWords('Google Gemini', 'Gemini 3.5 Flash-Lite')).toBe(
      'Google · Gemini 3.5 Flash-Lite',
    )
  })

  it('keeps the model alone when the provider is that one word', () => {
    expect(providerModelWords('Seedance', 'Seedance 2.0')).toBe('Seedance 2.0')
  })

  it('gives the plain provider when there is no model', () => {
    expect(providerModelWords('Amazon S3', null)).toBe('Amazon S3')
    expect(providerModelWords('Amazon S3', undefined)).toBe('Amazon S3')
  })

  it('splits into the two parts a two-line picker shows', () => {
    expect(providerModelParts('fal.ai Seedance', 'Seedance 2.0')).toEqual({
      provider: 'fal.ai',
      model: 'Seedance 2.0',
    })
    expect(providerModelParts('Amazon S3', null)).toEqual({ provider: 'Amazon S3', model: null })
  })
})

describe('jobModel and serviceWords [R3-2]', () => {
  it('names the registry model of the job', () => {
    expect(jobModel(gemini, 'image')).toBe('Nano Banana 2.1')
    expect(serviceWords(gemini, 'text')).toBe('Google · Gemini 3.5 Flash-Lite')
    expect(serviceWords(fal, 'video')).toBe('fal.ai · Seedance 2.0')
  })

  it('names ComfyUI’s model from the workflow the run would get', () => {
    expect(serviceWords(comfy, 'image', 'MOSS-Image')).toBe('ComfyUI · MOSS-Image')
    expect(serviceWords(comfy, 'image')).toBe('ComfyUI')
  })

  it('gives the plain label for a job with no model', () => {
    expect(serviceWords(s3, 'storage')).toBe('Amazon S3')
    expect(serviceWords({ id: 'x', label: 'Fake provider' }, 'image')).toBe('Fake provider')
  })
})

describe('modelList [R3-2]', () => {
  it('lists a provider’s models once each, in job order', () => {
    expect(modelList(gemini)).toBe('Nano Banana 2.1, Gemini 3.5 Flash-Lite')
    expect(modelList(fal)).toBe('Seedance 2.0')
  })

  it('gives null for a provider with no fixed model', () => {
    expect(modelList(comfy)).toBeNull()
    expect(modelList(s3)).toBeNull()
  })
})

describe('modelNameOf [R3-2]', () => {
  it('names a stored registry model ID', () => {
    expect(modelNameOf('gemini-nano-banana-2.1', providers)).toBe('Nano Banana 2.1')
    expect(modelNameOf('gemini-3.5-flash-lite', providers)).toBe('Gemini 3.5 Flash-Lite')
  })

  it('names every start path of one fal app as its model', () => {
    expect(modelNameOf('bytedance/seedance-2.0/text-to-video', providers)).toBe('Seedance 2.0')
    expect(modelNameOf('bytedance/seedance-2.0/reference-to-video', providers)).toBe('Seedance 2.0')
  })

  it('names a ComfyUI workflow’s main file by its model', () => {
    expect(modelNameOf('moss_image.safetensors', providers, workflows)).toBe('MOSS-Image')
  })

  it('falls back to the ID itself when the name is unknown', () => {
    expect(modelNameOf('some-other-model', providers, workflows)).toBe('some-other-model')
    expect(modelNameOf('bytedance/other/text-to-video', providers)).toBe(
      'bytedance/other/text-to-video',
    )
  })
})
