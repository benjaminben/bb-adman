// R3-2: the run tools' words name the model each provider uses, by name and model ID.
import { describe, expect, it } from 'vitest'
import { MCP_TOOLS } from '@/main/mcp/tools'

const words = (name: string) => MCP_TOOLS.find((t) => t.name === name)?.description ?? ''

describe('run tool words name the model [R3-2]', () => {
  it('generate_images names Gemini’s picture model and the ComfyUI picture models', () => {
    const text = words('generate_images')
    expect(text).toContain('Nano Banana 2.1, model ID "gemini-nano-banana-2.1"')
    expect(text).toContain('MOSS-Image')
    expect(text).toContain('FLUX 3 klein')
  })

  it('generate_video names the Seedance model and the ComfyUI video model', () => {
    const text = words('generate_video')
    expect(text).toContain('Seedance 2.0, model ID "bytedance/seedance-2.0/image-to-video"')
    expect(text).toContain('MiniMax H3')
  })

  it('propose_layout and copy_options name Gemini’s text model', () => {
    for (const name of ['propose_layout', 'copy_options']) {
      expect(words(name), name).toContain('Gemini 3.5 Flash-Lite, model ID "gemini-3.5-flash-lite"')
    }
  })

  it('cut_out names the ComfyUI cut-out model', () => {
    expect(words('cut_out')).toContain('BiRefNet')
  })
})
