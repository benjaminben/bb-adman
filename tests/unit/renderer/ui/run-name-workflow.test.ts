// D-104: a ComfyUI row that named its workflow (request.workflowId) is worded by that
// workflow, not by the one a run of its kind would get today.
import { describe, expect, it } from 'vitest'
import { rowModel, runName } from '@/renderer/ui/run-name/run-name'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import type { JobRow } from '@/shared/schemas/rows/job'

type Named = Pick<ProviderInfo, 'id' | 'label' | 'defaultModels' | 'modelLabels'>

const providers: Named[] = [{ id: 'comfyui', label: 'ComfyUI', defaultModels: {}, modelLabels: {} }]
const CUSTOM = 'custom-0123456789ab'
const INFO = {
  address: null,
  leavesOnServer: [],
  workflows: [
    {
      id: 'moss-image',
      job: 'image',
      status: 'proven',
      offered: true,
      isDefault: true,
      label: 'MOSS-Image: picture from a prompt',
      model: { label: 'MOSS-Image', mainFile: 'moss.safetensors' },
    },
    {
      id: 'other-image',
      job: 'image',
      status: 'trial',
      offered: false,
      isDefault: false,
      label: 'Other: picture from a prompt',
      model: { label: 'Other Model', mainFile: 'other.safetensors' },
    },
    {
      id: CUSTOM,
      job: 'image',
      status: 'custom',
      offered: true,
      isDefault: false,
      label: 'Harbour flare',
      model: { label: 'Custom workflow', mainFile: 'custom ComfyUI workflow' },
    },
  ],
} as unknown as ComfyInfo

const row = (workflowId: unknown) =>
  ({
    kind: 'image_generation',
    provider: 'comfyui',
    model: null,
    request: { workflowId },
  }) as JobRow

describe('rowModel for a run that named its workflow [D-104]', () => {
  it('names a custom workflow by its own name', () => {
    expect(rowModel(row(CUSTOM), providers, INFO)).toBe('Harbour flare')
    expect(runName(row(CUSTOM), providers, INFO, '')).toBe('ComfyUI · Harbour flare')
  })

  it('names a shipped workflow by its model, also one not offered now', () => {
    expect(rowModel(row('other-image'), providers, INFO)).toBe('Other Model')
  })

  it('reads "Custom workflow" for a custom one no longer on this computer', () => {
    expect(rowModel(row('custom-ffffffffffff'), providers, INFO)).toBe('Custom workflow')
  })

  it('falls back to the workflow its kind gets for an unknown ID or none', () => {
    expect(rowModel(row('gone-shipped'), providers, INFO)).toBe('MOSS-Image')
    expect(rowModel(row(7), providers, INFO)).toBe('MOSS-Image')
  })

  it('waits for comfy.getInfo', () => {
    expect(runName(row(CUSTOM), providers, null, '')).toBe('ComfyUI')
  })
})
