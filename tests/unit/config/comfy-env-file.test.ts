import { describe, it, expect } from 'vitest'
import { COMFY_ENV_NAMES, comfyEnvFrom } from '../../comfy/env-file'

describe('comfyEnvFrom [SPEC 6.10.12, 13 1.24]', () => {
  it('takes one name from the file: COMFY_BASE_URL', () => {
    expect(COMFY_ENV_NAMES).toEqual(['COMFY_BASE_URL'])
    expect(comfyEnvFrom('COMFY_BASE_URL=http://made-up.test:8188\n', {})).toEqual({
      COMFY_BASE_URL: 'http://made-up.test:8188',
    })
  })

  it('drops every other name, paid keys and the video switch included', () => {
    const text = [
      'GEMINI_API_KEY=made-up',
      'FAL_KEY=made-up',
      'ADMAN_COMFY_VIDEO=1',
      'ADMAN_DEV_TOOLS=1',
      'COMFY_OTHER=x',
    ].join('\n')
    expect(comfyEnvFrom(text, {})).toEqual({})
  })

  it('never takes the Flux or MOSS switch or the picture path from the file [1.53 G-12, 1.54 P-1]', () => {
    const text = [
      'ADMAN_COMFY_FLUX=1',
      'ADMAN_COMFY_MOSS=1',
      'ADMAN_COMFY_PICTURE=/made/up/picture.png',
    ].join('\n')
    expect(comfyEnvFrom(text, {})).toEqual({})
  })

  it('never takes the first-frame switch from the file [1.54 P-4]', () => {
    expect(comfyEnvFrom('ADMAN_COMFY_FRAME=1\n', {})).toEqual({})
  })

  it('a value set in the terminal wins', () => {
    const picked = comfyEnvFrom('COMFY_BASE_URL=http://file.test\n', {
      COMFY_BASE_URL: 'http://terminal.test',
    })
    expect(picked).toEqual({})
  })

  it('no file text is not an error', () => {
    expect(comfyEnvFrom('', {})).toEqual({})
  })
})
