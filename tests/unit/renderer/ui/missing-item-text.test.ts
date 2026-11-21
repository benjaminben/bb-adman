// S2-1: the text of one missing item, shared by Settings and the run row.
import { describe, it, expect } from 'vitest'
import { missingItemText } from '@/renderer/ui/missing-item-text'
import type { MissingItem } from '@/shared/schemas/queries/app'

describe('missingItemText [S2-1]', () => {
  const folder = ', in the folder custom_nodes'
  it.each<[MissingItem, string]>([
    [{ what: 'model', name: 'h3.safetensors' }, 'Model h3.safetensors'],
    [
      { what: 'model', name: 'h3.safetensors', folder: 'diffusion_models' },
      'Model h3.safetensors, in the folder diffusion_models',
    ],
    [{ what: 'node', name: 'SaveVideo' }, 'Node SaveVideo'],
    [{ what: 'node', name: 'SaveVideo', folder: 'custom_nodes' }, `Node SaveVideo${folder}`],
    [{ what: 'version', name: '0.45.0' }, 'ComfyUI version 0.45.0'],
    [
      { what: 'version', name: '0.45.0', folder: 'custom_nodes' },
      `ComfyUI version 0.45.0${folder}`,
    ],
    [{ what: 'add_on', name: 'VideoHelper' }, 'Add-on VideoHelper'],
    [
      { what: 'add_on', name: 'VideoHelper', folder: 'custom_nodes' },
      `Add-on VideoHelper${folder}`,
    ],
  ])('%o reads %s', (item, text) => {
    expect(missingItemText(item)).toBe(text)
  })
})
