// Made-up comfy.getInfo and comfy.check data for the Settings ComfyUI section tests.
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import { makeFakeApi } from '../../fake-api'

export const ADDRESS = 'http://192.168.1.50:8188'

export function workflow(overrides: Partial<WorkflowInfo> = {}): WorkflowInfo {
  return {
    id: 'moss-text-to-image',
    label: 'MOSS picture from a prompt',
    job: 'image',
    status: 'trial',
    model: { label: 'MOSS-Image', mainFile: 'moss.safetensors' },
    needs: { minComfyVersion: '0.3.0', checkedWith: '', models: [], nodeClasses: [], addOns: [] },
    size: { multiple: 16, minPixels: 65536, maxPixels: 4194304 },
    licence: { name: 'Apache-2.0', url: 'https://example.com/licence', commercialNote: null },
    leavesOnServer: [],
    offered: true,
    isDefault: true,
    ...overrides,
  }
}

export function info(overrides: Partial<ComfyInfo> = {}): ComfyInfo {
  return {
    address: ADDRESS,
    workflows: [],
    leavesOnServer: ['Each picture leaves a file in the server’s temporary folder.'],
    ...overrides,
  }
}

export function comfyFake(start: ComfyInfo = info(), check?: ComfyCheck) {
  const fake = makeFakeApi()
  let current = start
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: current }))
  if (check) fake.onCommand('comfy.check', () => ({ ok: true, data: check }))
  return { fake, setInfo: (next: ComfyInfo) => (current = next) }
}
